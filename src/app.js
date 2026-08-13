const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const notFound = require('./api/middlewares/notFound');
const errorHandler = require('./api/middlewares/errorHandler');
const apiRoutes = require('./api/routes');
const swaggerSpec = require('./infrastructure/swagger/swaggerSpec');
const config = require('./infrastructure/config/env');

const app = express();

// CSP disabled: swagger-ui-express serves inline scripts/styles that a strict default CSP would block.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
