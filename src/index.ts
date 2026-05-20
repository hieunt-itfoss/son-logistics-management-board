import { Hono } from 'hono';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';
import { khachHangRoutes } from './routes/khach-hang';
import { hangRoutes } from './routes/hang';
import { tuyenRoutes } from './routes/tuyen';
import { xeRoutes } from './routes/xe';
import { taiXeRoutes } from './routes/tai-xe';
import { chuyenXeRoutes } from './routes/chuyen-xe';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/', authRoutes);

const protectedApp = new Hono<{ Bindings: Env }>();
protectedApp.use('*', authMiddleware);

protectedApp.route('/', dashboardRoutes);
protectedApp.route('/khach-hang', khachHangRoutes);
protectedApp.route('/hang', hangRoutes);
protectedApp.route('/tuyen', tuyenRoutes);
protectedApp.route('/xe', xeRoutes);
protectedApp.route('/tai-xe', taiXeRoutes);
protectedApp.route('/chuyen-xe', chuyenXeRoutes);

app.route('/', protectedApp);

export default app;
