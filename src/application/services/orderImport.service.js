const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Order, OrderEvent } = require('../../domain/models');
const { sha256Hex } = require('../utils/hash.util');
const AppError = require('../errors/AppError');

const MAX_ROWS = 500;

const COLUMN_ALIASES = {
  vtpcode: 'vtpCode',
  receivername: 'receiverName',
  receiverphone: 'receiverPhone',
  receiveraddress: 'receiverAddress',
  productinfo: 'productInfo',
  weightkg: 'weightKg',
};
const REQUIRED_FIELDS = ['vtpCode', 'receiverName', 'receiverPhone', 'receiverAddress', 'productInfo', 'weightKg'];

function cellToString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('');
    if (value.text !== undefined) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
  }
  return String(value).trim();
}

function buildColumnMap(headerRow) {
  const map = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = cellToString(cell.value).toLowerCase().replace(/[^a-z]/g, '');
    if (COLUMN_ALIASES[key]) {
      map[colNumber] = COLUMN_ALIASES[key];
    }
  });
  return map;
}

// Creates the Order and its orderEvents(import) row in one transaction, so a crash or error
// between the two can never leave an order with no import history (previously handled by a
// manual "delete the order if the event insert fails" rollback, which isn't atomic against a
// concurrent read of that order in the gap between the two writes). vtpCode is the partner's own
// VTP-generated code (the only code that exists - see PROJECT_CONTEXT.md), so its uniqueness is
// already guaranteed by the pre-check in the caller plus the schema's unique index; no retry loop
// needed here (that was only ever for random internalCode collisions, since removed).
async function createOrderRecord({
  vtpCode,
  partnerObjectId,
  receiverName,
  receiverPhone,
  receiverAddress,
  productInfo,
  weightKg,
  now,
  actorUserObjectId,
  record,
}) {
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      [order] = await Order.create(
        [
          {
            vtpCode,
            partnerId: partnerObjectId,
            receiverName,
            receiverPhone,
            receiverAddress,
            productInfo,
            weightKg,
            currentStatus: 'imported',
            currentStatusDate: now,
          },
        ],
        { session }
      );

      const contentHash = sha256Hex(`import:${vtpCode}`);
      await OrderEvent.create(
        [
          {
            orderId: order._id,
            source: 'import',
            eventType: 'import',
            actorUserId: actorUserObjectId,
            rawPayload: record,
            contentHash,
            eventTime: now,
            receivedAt: now,
          },
        ],
        { session }
      );
    });
    return { order, error: null };
  } catch (err) {
    if (err.code === 11000 && err.keyValue && err.keyValue.vtpCode) {
      return { order: null, error: 'vtpCode đã tồn tại trong hệ thống' };
    }
    return { order: null, error: 'Lỗi khi tạo đơn hàng' };
  } finally {
    await session.endSession();
  }
}

// FR-03: import up to 500 rows/call, one order + one orderEvents(source=import) per valid row.
// Never aborts the whole batch on a single bad row - each row gets its own success/error result.
async function importOrdersFromExcel({ fileBuffer, partnerObjectId, actorUserObjectId }) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (err) {
    throw new AppError('File Excel không hợp lệ', 400);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError('File Excel không có dữ liệu', 400);
  }

  const columnMap = buildColumnMap(worksheet.getRow(1));
  const mappedFields = new Set(Object.values(columnMap));
  const missingRequired = REQUIRED_FIELDS.filter((field) => !mappedFields.has(field));
  if (missingRequired.length > 0) {
    throw new AppError(`Thiếu cột bắt buộc: ${missingRequired.join(', ')}`, 400);
  }

  const dataRowNumbers = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    dataRowNumbers.push(rowNumber);
  });

  if (dataRowNumbers.length === 0) {
    throw new AppError('File Excel không có dòng dữ liệu nào', 400);
  }
  if (dataRowNumbers.length > MAX_ROWS) {
    throw new AppError(`Chỉ hỗ trợ tối đa ${MAX_ROWS} dòng/lần import`, 400);
  }

  const seenInFile = new Set();
  const results = [];
  const now = new Date();

  for (const rowNumber of dataRowNumbers) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    Object.entries(columnMap).forEach(([colNumber, field]) => {
      record[field] = cellToString(row.getCell(Number(colNumber)).value);
    });

    const vtpCode = record.vtpCode || '';
    const receiverName = record.receiverName || '';
    const receiverPhone = record.receiverPhone || '';
    const receiverAddress = record.receiverAddress || '';
    const productInfo = record.productInfo || '';

    const missingField = REQUIRED_FIELDS.find((field) => !record[field]);
    if (missingField) {
      results.push({ row: rowNumber, success: false, error: `${missingField} không được để trống` });
      continue;
    }

    const weightKg = Number(record.weightKg);
    if (Number.isNaN(weightKg) || weightKg < 0) {
      results.push({ row: rowNumber, success: false, error: 'weightKg phải là số >= 0' });
      continue;
    }

    if (seenInFile.has(vtpCode)) {
      results.push({ row: rowNumber, success: false, error: 'vtpCode bị trùng trong file' });
      continue;
    }
    seenInFile.add(vtpCode);

    // eslint-disable-next-line no-await-in-loop
    const existing = await Order.findOne({ vtpCode }).select('_id').lean();
    if (existing) {
      results.push({ row: rowNumber, success: false, error: 'vtpCode đã tồn tại trong hệ thống' });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const { order, error } = await createOrderRecord({
      vtpCode,
      partnerObjectId,
      receiverName,
      receiverPhone,
      receiverAddress,
      productInfo,
      weightKg,
      now,
      actorUserObjectId,
      record,
    });
    if (!order) {
      results.push({ row: rowNumber, success: false, error });
      continue;
    }

    results.push({ row: rowNumber, success: true, vtpCode: order.vtpCode });
  }

  const successCount = results.filter((r) => r.success).length;
  return {
    totalRows: results.length,
    successCount,
    failureCount: results.length - successCount,
    results,
  };
}

module.exports = { importOrdersFromExcel, MAX_ROWS };
