import express from 'express';
import apiRouter from './routes/api.js';

const app = express();
const port = process.env.PORT || 2026;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from untye API' });
});

app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

export default app;
