// ==================== CRON JOB HANDLER ====================
import { updateDailyStats } from './dashboardStats.js';

export async function handleCron(event, env, ctx) {
  console.log('🕛 Running daily stats update at:', new Date().toISOString());
  
  try {
    await updateDailyStats(env);
    console.log('✅ Daily stats updated successfully');
  } catch (error) {
    console.error('❌ Error updating daily stats:', error);
  }
}