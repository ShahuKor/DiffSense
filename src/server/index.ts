import 'dotenv/config';
import express from 'express';
import { rawBodyMiddleware, webhookHandler } from './webhook';
import { logger } from '../shared/logger';

const app = express();

app.use('/webhook', rawBodyMiddleware);
app.post('/webhook', webhookHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  logger.info(`ReviewBot server listening on port ${PORT}`);
});
