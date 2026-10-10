// Cấu hình drizzle-kit: đọc schema TypeScript → sinh migration SQL vào thư mục drizzle/.
// Chạy: npm run db:generate (mỗi lần sửa src/db/schema.ts)
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
