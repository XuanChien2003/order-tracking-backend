const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'New Horizon Logistics - Cross-border Order API',
      version: '1.0.0',
      description: 'API quản lý đơn hàng xuyên biên giới (kho Bằng Tường - Viettel Post)',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // glob (used internally by swagger-jsdoc) needs forward slashes even on Windows
  apis: [path.join(__dirname, '../../api/routes/*.js').split(path.sep).join('/')],
};

module.exports = swaggerJsdoc(options);
