const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const notFound = require('./api/middlewares/notFound');
const errorHandler = require('./api/middlewares/errorHandler');
const { generalLimiter } = require('./api/middlewares/rateLimit.middleware');
const apiRoutes = require('./api/routes');
const swaggerSpec = require('./infrastructure/swagger/swaggerSpec');
const config = require('./infrastructure/config/env');

const app = express();

// Render (and most PaaS) puts the app behind exactly one reverse-proxy hop. Without this, Express
// ignores X-Forwarded-For and req.ip resolves to that proxy's own address for every request -
// identical for every real client - so express-rate-limit (which keys by req.ip) ends up rate
// limiting the whole service's combined traffic instead of each caller individually. That's what
// caused unrelated users to occasionally get "Quá nhiều lần đăng nhập" from other people's attempts.
app.set('trust proxy', 1);

// Swagger UI's inline scripts/styles need CSP relaxed just for its own routes - registering this
// *before* the strict global helmet below means it fully handles+ends the /api/docs request
// (never falling through to the strict one), while every other route still gets full CSP.
// Also gated to non-production so the API surface isn't self-documented to the public internet.
if (config.nodeEnv !== 'production') {
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(helmet());

// Browser clients (the admin web) are restricted to an explicit allowlist; non-browser callers
// (the mobile app, curl, VTP's own webhook caller) send no Origin header at all and are let
// through regardless, since Origin-based CORS has nothing to enforce for them.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Nguồn gọi không được phép (CORS)'));
    },
  })
);

// No endpoint here legitimately needs a large JSON body (Excel import goes through multer/
// multipart, not this parser) - a tight explicit limit caps memory use from oversized requests.
app.use(express.json({ limit: '512kb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
