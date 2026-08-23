import { ok } from '@/lib/api/response';
import { getSiteConfig } from '@/lib/config';

/** 公开站点配置（不含内部敏感项） */
export async function GET() {
  const cfg = await getSiteConfig();
  return ok({
    site_name: cfg.site_name,
    site_logo: cfg.site_logo,
    register_enabled: cfg.register_enabled,
    chat_enabled: cfg.chat_enabled,
    payment_enabled: cfg.payment_enabled,
    default_city: cfg.default_city,
    page_size: cfg.page_size,
    upload_max_mb: cfg.upload_max_mb,
    maintenance_mode: cfg.maintenance_mode,
    maintenance_msg: cfg.maintenance_msg,
    icp_no: cfg.icp_no,
    contact_email: cfg.contact_email,
  });
}
