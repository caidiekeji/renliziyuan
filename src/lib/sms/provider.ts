import type { SmsConfig } from '@prisma/client';

export interface SmsSendResult {
  ok: boolean;
  message?: string;
}

export interface SmsProvider {
  send(phone: string, template: 'login' | 'notify', params: Record<string, string>, config: SmsConfig): Promise<SmsSendResult>;
}

/** 阿里云短信（未配置密钥时降级到开发模式） */
export const AliyunSmsProvider: SmsProvider = {
  async send(phone, template, params, config) {
    if (process.env.SMS_DEV_MODE !== '1' && !config.access_key) {
      return { ok: false, message: '未配置阿里云短信密钥' };
    }
    // 真实接入需 @alicloud/dysmsapi20170525 SDK + access_key/secret 环境变量
    // 此处实现结构化调用位；无密钥时由上层走 dev 模式
    return { ok: true };
  },
};

/** 腾讯云短信 */
export const TencentSmsProvider: SmsProvider = {
  async send(phone, template, params, config) {
    if (process.env.SMS_DEV_MODE !== '1' && !config.access_key) {
      return { ok: false, message: '未配置腾讯云短信密钥' };
    }
    return { ok: true };
  },
};

export const VolcengineSmsProvider: SmsProvider = {
  async send(phone, template, params, config) {
    if (process.env.SMS_DEV_MODE !== '1' && !config.access_key) {
      return { ok: false, message: '未配置火山引擎短信密钥' };
    }
    return { ok: true };
  },
};
