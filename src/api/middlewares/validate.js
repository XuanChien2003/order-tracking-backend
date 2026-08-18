// Joi's default messages are English ("\"username\" is required") and would leak straight past
// every FE's `err.message || <Vietnamese fallback>` pattern, since a truthy English string wins
// over the fallback. Building the message ourselves from `type`/`path`/`context` instead of
// reading Joi's own `detail.message` keeps every validation error in Vietnamese without having to
// hand-write `.messages()` overrides on every single schema field.
const FIELD_LABELS = {
  companyName: 'Tên công ty',
  contactEmail: 'Email liên hệ',
  contactPhone: 'SĐT liên hệ',
  password: 'Mật khẩu',
  username: 'Tên đăng nhập',
  displayName: 'Tên hiển thị',
  role: 'Vai trò',
  status: 'Trạng thái',
  currentPassword: 'Mật khẩu hiện tại',
  newPassword: 'Mật khẩu mới',
};

function fieldLabel(detail) {
  const key = detail.path[detail.path.length - 1];
  return FIELD_LABELS[key] || String(key);
}

function translateDetail(detail) {
  const field = fieldLabel(detail);
  switch (detail.type) {
    case 'any.required':
      return `${field} là bắt buộc`;
    case 'string.empty':
      return `${field} không được để trống`;
    case 'string.email':
      return `${field} phải là email hợp lệ`;
    case 'string.min':
      return `${field} phải có ít nhất ${detail.context.limit} ký tự`;
    case 'string.max':
      return `${field} không được quá ${detail.context.limit} ký tự`;
    case 'string.pattern.base':
      if (detail.path[detail.path.length - 1] === 'newPassword') {
        return 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số';
      }
      return `${field} không đúng định dạng`;
    case 'any.only':
      return `${field} không hợp lệ`;
    case 'object.min':
      return 'Cần ít nhất một trường để cập nhật';
    default:
      return `${field} không hợp lệ`;
  }
}

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map(translateDetail).join('; ');
      res.status(400).json({ error: message });
      return;
    }
    req.body = value;
    next();
  };
}

module.exports = { validateBody };
