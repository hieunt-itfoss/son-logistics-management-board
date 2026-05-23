import { Hono } from 'hono';
import type { Env, AppVariables } from './types';
import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbac';
import { authRoutes, changePasswordRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';
import { doiTacRoutes } from './routes/doi-tac';
import { tuyenRoutes } from './routes/tuyen';
import { chuyenXeRoutes } from './routes/chuyen-xe';
import { loHangRoutes } from './routes/lo-hang';
import { khoRoutes } from './routes/kho';
import { nhanVienRoutes } from './routes/nhan-vien';
import { chamCongRoutes } from './routes/cham-cong';
import { thuChiRoutes } from './routes/thu-chi';
import { congCuRoutes } from './routes/cong-cu';
import { managerRoutes } from './routes/manager';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/', authRoutes);

const protectedApp = new Hono<{ Bindings: Env; Variables: AppVariables }>();
protectedApp.use('*', authMiddleware);
protectedApp.use('*', rbacMiddleware);

protectedApp.route('/', changePasswordRoutes);
protectedApp.route('/', dashboardRoutes);
protectedApp.route('/doi-tac', doiTacRoutes);
protectedApp.route('/tuyen', tuyenRoutes);
protectedApp.route('/chuyen-xe', chuyenXeRoutes);
protectedApp.route('/lo-hang', loHangRoutes);
protectedApp.route('/kho', khoRoutes);
protectedApp.route('/nhan-vien', nhanVienRoutes);
protectedApp.route('/cham-cong', chamCongRoutes);
protectedApp.route('/thu-chi', thuChiRoutes);
protectedApp.route('/cong-cu', congCuRoutes);
protectedApp.route('/manager', managerRoutes);

app.route('/', protectedApp);

export default app;
