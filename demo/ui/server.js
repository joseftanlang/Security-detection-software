import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const port = Number(process.env.PORT || 8080);
const apiBaseUrl = process.env.API_BASE_URL || 'http://api:2026';

app.use('/api', createProxyMiddleware({
  target: apiBaseUrl,
  changeOrigin: true,
  secure: false,
  pathRewrite: (path) => `/api${path}`
}));

app.use(express.static('public'));
app.get('/health', (_, res) => {
  res.json({ ok: true, apiBaseUrl });
});

app.listen(port, () => {
  console.log(`Demo UI listening on http://0.0.0.0:${port}`);
});
