import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CITIES } from '../src/lib/seed/cities';

const prisma = new PrismaClient();

// ================= 行业（二级结构，约 50 个） =================
const INDUSTRIES: { name: string; code: string; children?: { name: string; code: string }[] }[] = [
  { name: '互联网', code: 'INTERNET', children: [
    { name: '社交', code: 'INTERNET_SOCIAL' }, { name: '电商', code: 'INTERNET_ECOMMERCE' },
    { name: '内容', code: 'INTERNET_CONTENT' }, { name: '工具', code: 'INTERNET_TOOLS' },
    { name: 'O2O', code: 'INTERNET_O2O' }, { name: '企业服务', code: 'INTERNET_ENTERPRISE' },
  ]},
  { name: '金融', code: 'FINANCE', children: [
    { name: '银行', code: 'FINANCE_BANK' }, { name: '保险', code: 'FINANCE_INSURANCE' },
    { name: '证券', code: 'FINANCE_SECURITIES' }, { name: '投资', code: 'FINANCE_INVESTMENT' },
    { name: '互联网金融', code: 'FINANCE_FINTECH' },
  ]},
  { name: '医疗健康', code: 'MEDICAL', children: [
    { name: '医院', code: 'MEDICAL_HOSPITAL' }, { name: '医药', code: 'MEDICAL_PHARMA' },
    { name: '医疗器械', code: 'MEDICAL_DEVICE' }, { name: '互联网医疗', code: 'MEDICAL_ONLINE' },
    { name: '生物科技', code: 'MEDICAL_BIO' },
  ]},
  { name: '教育培训', code: 'EDUCATION', children: [
    { name: 'K12', code: 'EDU_K12' }, { name: '职业教育', code: 'EDU_VOCATIONAL' },
    { name: '语言培训', code: 'EDU_LANGUAGE' }, { name: '在线教育', code: 'EDU_ONLINE' },
    { name: '早幼教', code: 'EDU_EARLY' },
  ]},
  { name: '制造业', code: 'MANUFACTURING', children: [
    { name: '汽车制造', code: 'MFG_AUTO' }, { name: '电子制造', code: 'MFG_ELECTRONIC' },
    { name: '机械制造', code: 'MFG_MACHINERY' }, { name: '化工', code: 'MFG_CHEMICAL' },
    { name: '食品加工', code: 'MFG_FOOD' },
  ]},
  { name: '房地产建筑', code: 'REAL_ESTATE', children: [
    { name: '房地产开发', code: 'RE_DEVELOP' }, { name: '建筑施工', code: 'RE_CONSTRUCTION' },
    { name: '物业', code: 'RE_PROPERTY' }, { name: '家居装饰', code: 'RE_DECORATION' },
  ]},
  { name: '零售消费', code: 'RETAIL', children: [
    { name: '商超', code: 'RETAIL_SUPERMARKET' }, { name: '品牌服饰', code: 'RETAIL_FASHION' },
    { name: '快消品', code: 'RETAIL_FMCG' }, { name: '奢侈品', code: 'RETAIL_LUXURY' },
    { name: '新零售', code: 'RETAIL_NEW' },
  ]},
  { name: '物流运输', code: 'LOGISTICS', children: [
    { name: '快递', code: 'LOG_EXPRESS' }, { name: '仓储', code: 'LOG_WAREHOUSE' },
    { name: '货运', code: 'LOG_FREIGHT' }, { name: '供应链', code: 'LOG_SUPPLYCHAIN' },
  ]},
  { name: '文化传媒', code: 'MEDIA', children: [
    { name: '影视', code: 'MEDIA_FILM' }, { name: '广告营销', code: 'MEDIA_AD' },
    { name: '游戏', code: 'MEDIA_GAME' }, { name: '出版', code: 'MEDIA_PUBLISH' },
    { name: 'MCN', code: 'MEDIA_MCN' },
  ]},
  { name: '能源环保', code: 'ENERGY', children: [
    { name: '电力', code: 'ENERGY_POWER' }, { name: '石油天然气', code: 'ENERGY_OILGAS' },
    { name: '新能源', code: 'ENERGY_NEW' }, { name: '环保', code: 'ENERGY_ENV' },
  ]},
  { name: '农牧业', code: 'AGRICULTURE', children: [
    { name: '种植', code: 'AGRI_FARMING' }, { name: '养殖', code: 'AGRI_BREEDING' },
    { name: '农业科技', code: 'AGRI_TECH' },
  ]},
  { name: '服务业', code: 'SERVICE', children: [
    { name: '餐饮', code: 'SVC_CATERING' }, { name: '酒店旅游', code: 'SVC_HOTEL' },
    { name: '美业', code: 'SVC_BEAUTY' }, { name: '家政', code: 'SVC_HOME' },
  ]},
  { name: '政府事业单位', code: 'GOVERNMENT', children: [
    { name: '事业单位', code: 'GOV_INSTITUTION' }, { name: '国有企业', code: 'GOV_SOE' },
  ]},
  { name: '其他', code: 'OTHER', children: [
    { name: '咨询', code: 'OTHER_CONSULTING' }, { name: '法律', code: 'OTHER_LEGAL' },
    { name: '财会', code: 'OTHER_ACCOUNTING' }, { name: '人力资源', code: 'OTHER_HR' },
  ]},
];

// ================= 职位名称（三级结构，约 300 个） =================
const JOB_TITLES: { category: string; sub_category: string; names: string[] }[] = [
  { category: '技术', sub_category: '前端开发', names: ['前端工程师','Web前端工程师','H5开发工程师','小程序开发工程师','前端架构师','Electron开发工程师','可视化工程师','低代码开发工程师','WebGL工程师','前端实习生'] },
  { category: '技术', sub_category: '后端开发', names: ['Java开发工程师','Python开发工程师','Go开发工程师','Node.js开发工程师','PHP开发工程师','C++开发工程师','.NET开发工程师','后端架构师','Ruby开发工程师','全栈工程师','云原生开发工程师','中间件开发工程师','消息队列工程师','微服务架构师','后端实习生'] },
  { category: '技术', sub_category: '移动开发', names: ['iOS开发工程师','Android开发工程师','Flutter开发工程师','React Native开发工程师','移动端架构师','鸿蒙开发工程师','移动端测试工程师'] },
  { category: '技术', sub_category: '数据开发', names: ['数据开发工程师','大数据开发工程师','ETL工程师','数据仓库工程师','实时计算工程师','数仓架构师','数据治理工程师','数据挖掘工程师','数据标注工程师'] },
  { category: '技术', sub_category: '算法', names: ['算法工程师','机器学习工程师','深度学习工程师','NLP算法工程师','CV算法工程师','推荐算法工程师','搜索算法工程师','风控算法工程师','音视频算法工程师','推荐架构师','算法实习生'] },
  { category: '技术', sub_category: '测试', names: ['测试工程师','自动化测试工程师','测试开发工程师','性能测试工程师','测试架构师','安全测试工程师','质量保障工程师'] },
  { category: '技术', sub_category: '运维', names: ['运维工程师','SRE工程师','DevOps工程师','DBA','网络安全工程师','云平台工程师','自动化运维工程师','网络工程师','数据库运维工程师','机房运维工程师'] },
  { category: '技术', sub_category: '硬件开发', names: ['嵌入式开发工程师','硬件工程师','FPGA工程师','芯片设计工程师','IC验证工程师','单片机工程师'] },
  { category: '技术', sub_category: '人工智能', names: ['AI工程师','大模型算法工程师','AIGC算法工程师','RAG算法工程师','智能体开发工程师','提示词工程师'] },
  { category: '技术', sub_category: '技术管理', names: ['技术经理','研发经理','技术总监','CTO','项目主管'] },
  { category: '产品', sub_category: '产品经理', names: ['产品经理','高级产品经理','B端产品经理','C端产品经理','数据产品经理','AI产品经理','产品总监','策略产品经理','硬件产品经理'] },
  { category: '产品', sub_category: '产品设计', names: ['交互设计师','UI设计师','视觉设计师','体验设计师','设计总监','UE设计师'] },
  { category: '产品', sub_category: '项目管理', names: ['项目经理','敏捷教练','技术项目管理','交付经理','PMP经理'] },
  { category: '运营', sub_category: '用户运营', names: ['用户运营','社群运营','私域运营','会员运营','粉丝运营','社区运营'] },
  { category: '运营', sub_category: '内容运营', names: ['内容运营','新媒体运营','短视频运营','直播运营','文案策划','编辑','本地生活运营','达人运营','海外运营'] },
  { category: '运营', sub_category: '电商运营', names: ['电商运营','天猫运营','京东运营','拼多多运营','店铺运营','选品专员','抖店运营','跨境电商运营'] },
  { category: '运营', sub_category: '增长运营', names: ['增长黑客','投放优化师','SEO优化师','ASO优化师','活动运营','数据运营','商业化运营','门店运营'] },
  { category: '运营', sub_category: '运营管理', names: ['运营主管','运营经理','运营总监'] },
  { category: '市场', sub_category: '品牌营销', names: ['品牌经理','市场专员','市场经理','公关经理','活动策划','媒介专员','品牌策划','市场营销','会展策划','海外市场','公关专员'] },
  { category: '市场', sub_category: '商务拓展', names: ['商务拓展','渠道经理','大客户经理','KA销售','政企销售','渠道销售'] },
  { category: '销售', sub_category: '销售', names: ['销售代表','销售顾问','电话销售','网络销售','销售经理','销售总监','区域销售','门店销售','汽车销售顾问','房产销售顾问'] },
  { category: '职能', sub_category: '人力资源', names: ['招聘专员','招聘经理','HRBP','薪酬绩效专员','培训专员','HR总监','人事专员','员工关系专员','组织发展专家','绩效经理'] },
  { category: '职能', sub_category: '行政', names: ['行政专员','行政主管','前台','文员','司机','后勤专员','保洁主管'] },
  { category: '职能', sub_category: '财务', names: ['会计','出纳','财务经理','财务总监','审计专员','税务专员','成本会计','预算专员','总账会计'] },
  { category: '职能', sub_category: '法务', names: ['法务专员','法务经理','法务总监','合规专员','法务助理'] },
  { category: '职能', sub_category: '客服', names: ['客服专员','客服主管','在线客服','呼叫中心专员','售后专员','投诉处理专员'] },
  { category: '数据', sub_category: '数据分析', names: ['数据分析师','商业分析师','经营分析师','用户研究员','BI工程师'] },
  { category: '设计', sub_category: '视觉设计', names: ['平面设计师','插画师','品牌设计师','广告设计师','电商设计师','包装设计师','服装设计师','室内设计师'] },
  { category: '设计', sub_category: '三维设计', names: ['3D设计师','三维建模师','渲染师','动画师','游戏原画师','游戏模型师','游戏特效师','游戏UI设计师'] },
  { category: '金融', sub_category: '金融业务', names: ['投资经理','风控经理','信贷专员','基金经理','量化研究员','理财顾问','证券分析师','保险顾问','金融分析师','投行分析师','催收专员'] },
  { category: '教育', sub_category: '教学教研', names: ['学科老师','教研员','课程顾问','助教','留学顾问','培训讲师','编程老师','美术老师','音乐老师','体育老师','早教老师','保育员'] },
  { category: '医疗', sub_category: '医疗', names: ['医生','护士','药师','检验师','康复治疗师','医学编辑','医疗顾问','牙医','兽医','营养师','药剂师','护士长'] },
  { category: '物流', sub_category: '物流仓储', names: ['仓储管理员','分拣员','快递员','配送员','调度员','物流经理','关务专员','快递站长','货运司机','叉车司机','仓库主管'] },
  { category: '生产制造', sub_category: '生产制造', names: ['普工','操作工','质检员','生产主管','设备工程师','电工','焊工','钳工','仓库管理员','数控操作员','注塑工','装配工','包装工','生产文员'] },
  { category: '餐饮酒店', sub_category: '餐饮酒店', names: ['服务员','厨师','传菜员','店长','烘焙师','咖啡师','酒店前台','客房服务员','后厨帮工','面点师','调酒师','餐厅领班'] },
  { category: '采购贸易', sub_category: '采购贸易', names: ['采购专员','采购经理','外贸业务员','跟单员','报关员','供应链专员','采购主管','供应商管理','采购助理'] },
  { category: '游戏', sub_category: '游戏开发', names: ['游戏客户端开发','游戏服务端开发','Unity开发工程师','Unreal开发工程师','游戏引擎工程师'] },
  { category: '游戏', sub_category: '游戏策划', names: ['游戏策划','数值策划','关卡策划','战斗策划'] },
  { category: '建筑地产', sub_category: '建筑设计', names: ['建筑设计师','结构工程师','暖通工程师','给排水工程师','电气工程师'] },
  { category: '建筑地产', sub_category: '工程管理', names: ['造价工程师','监理工程师','施工员','安全员','资料员','工程经理'] },
  { category: '建筑地产', sub_category: '房产', names: ['房产经纪人','置业顾问','房产评估师'] },
  { category: '汽车', sub_category: '汽车制造', names: ['汽车电子工程师','车身设计工程师','动力系统工程师','新能源工程师'] },
  { category: '汽车', sub_category: '汽车服务', names: ['汽车维修技师','汽车美容师','二手车评估师'] },
  { category: '能源环保', sub_category: '能源', names: ['光伏工程师','风电工程师','储能工程师','能源管理师','电力工程师'] },
  { category: '能源环保', sub_category: '环保', names: ['环保工程师','水处理工程师','环境监测员'] },
  { category: '传媒广告', sub_category: '影视传媒', names: ['广告策划','媒介策划','创意总监','摄影摄像','剪辑师','编剧','主持人','配音员'] },
  { category: '法律', sub_category: '法律专业', names: ['律师','法务助理','专利代理人','商标代理人'] },
  { category: '其他', sub_category: '其他', names: ['管培生','实习生','兼职','其他'] },
];

async function main() {
  console.log('🌱 开始播种...');

  // ---- 管理员 ----
  const adminPhone = process.env.SEED_ADMIN_PHONE || '13800000000';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123456';
  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      phone: adminPhone,
      name: '平台管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
      password_hash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log('管理员:', admin.phone, admin.name);

  // ---- 条款（幂等：已存在该 key 的任一版本则跳过，尊重后台人工编辑） ----
  const POLICIES: { key: string; title: string; content: string }[] = [
    {
      key: 'register-agreement',
      title: '注册须知',
      content:
        '欢迎注册职桥 JobBridge。\n\n1. 注册即表示你同意《使用须知》与《隐私政策》。\n2. 请如实填写手机号与身份信息，提供的资料不得侵犯他人合法权益。\n3. 一个手机号对应一个账号与一个主角色（求职者/企业/管理员互斥）。\n4. 平台有权依据法律法规对违规账号进行封禁或注销。',
    },
    {
      key: 'terms',
      title: '使用须知',
      content:
        '欢迎使用职桥 JobBridge。\n\n1. 平台连接企业与求职者，提供职位发布、浏览、沟通、评价等服务。\n2. 禁止发布虚假职位、涉黄涉赌、诈骗等违法违规内容。\n3. 请通过平台提供的即时通讯进行沟通，切勿通过陌生链接交易或转账。\n4. 企业对职位描述的真实性负责，求职者对企业资质负责核验。\n5. 违反本须知的账号，平台有权采取警告、下架、封禁等措施。',
    },
    {
      key: 'privacy',
      title: '隐私政策',
      content:
        '我们非常重视你的个人信息保护。\n\n1. 我们仅收集为你提供服务所必需的信息，包括手机号、昵称、职位资料等。\n2. 定位信息仅用于所在城市推荐，用户精确坐标不落库。\n3. 未经你同意，我们不会向无关第三方出售或共享你的个人信息。\n4. 你有权查阅、更正或注销账号，注销后相关信息将按规则清除或脱敏。\n5. 如有任何隐私问题，可通过平台公布的邮箱联系我们。',
    },
  ];
  for (const p of POLICIES) {
    const existing = await prisma.policy.findFirst({ where: { key: p.key } });
    if (existing) continue;
    await prisma.policy.create({
      data: {
        key: p.key,
        title: p.title,
        content: p.content,
        status: 'PUBLISHED',
        published_at: new Date(),
        published_by: admin.id,
        effective_from: new Date(),
        created_by: admin.id,
      },
    });
  }
  console.log('条款: 已确保注册须知/使用须知/隐私政策存在');

  // ---- 单行配置 ----
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.recommendationConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.backupConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.seoConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // ---- 前台首页一级栏目（幂等：仅空表时初始化默认项）----
  if ((await prisma.navMenu.count()) === 0) {
    const defaultNavs = [
      { label: '职位', href: '/jobs', sort: 1 },
      { label: '小时工', href: '/hourly-jobs', sort: 2 },
      { label: '人才广场', href: '/seekers', sort: 3 },
      { label: '城市地图', href: '/map', sort: 4 },
    ];
    for (const n of defaultNavs) {
      await prisma.navMenu.create({ data: { label: n.label, href: n.href, sort: n.sort, active: true } });
    }
  }
  console.log('栏目: 已确保前台首页一级栏目存在');

  // ---- 默认套餐 ----
  const freePlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '免费版', price_monthly: 0, price_yearly: 0,
      job_limit: 3, can_feature: false, can_view_contacts: false,
      duration_days: 99999, active: true,
    },
  });
  await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: '标准版', price_monthly: 199, price_yearly: 1990,
      job_limit: 30, can_feature: true, can_view_contacts: true,
      duration_days: 30, active: true,
    },
  });
  await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: '旗舰版', price_monthly: 499, price_yearly: 4990,
      job_limit: 999999, can_feature: true, can_view_contacts: true,
      duration_days: 365, active: true,
    },
  });
  console.log('套餐:', freePlan.name, '等 3 个');

  // ---- 行业（二级） ----
  let industryCount = 0;
  for (const ind of INDUSTRIES) {
    const parent = await prisma.industry.upsert({
      where: { code: ind.code },
      update: {},
      create: { name: ind.name, code: ind.code, parent_id: null, sort: 100 - industryCount, active: true },
    });
    industryCount++;
    for (const child of ind.children || []) {
      await prisma.industry.upsert({
        where: { code: child.code },
        update: {},
        create: { name: child.name, code: child.code, parent_id: parent.id, sort: 100, active: true },
      });
      industryCount++;
    }
  }
  console.log('行业:', industryCount, '个');

  // ---- 职位名称（三级） ----
  let titleCount = 0;
  let codeIdx = 0;
  for (const cat of JOB_TITLES) {
    for (const name of cat.names) {
      const code = `JT${String(++codeIdx).padStart(5, '0')}`;
      await prisma.jobTitle.upsert({
        where: { code },
        update: {},
        create: {
          category: cat.category,
          sub_category: cat.sub_category,
          name,
          code,
          sort: 100 - (cat.names.length - cat.names.indexOf(name)),
          active: true,
        },
      });
      titleCount++;
    }
  }
  console.log('职位名称:', titleCount, '个');

  // ---- 337 城市（GCJ-02 坐标） ----
  let cityCount = 0;
  for (const c of CITIES) {
    await prisma.city.upsert({
      where: { name: c[1] },
      update: {},
      create: { name: c[1], province: c[0], lat: c[2], lng: c[3], coord_type: 'GCJ02', source: 'seed' },
    });
    cityCount++;
  }
  console.log('城市:', cityCount, '个');

  // ---- 通知模板 + 规则（幂等：event_type 已存在则跳过） ----
  const NOTIFY_TEMPLATES: { event_type: string; title_template: string; body_template: string; channels?: string[] }[] = [
    { event_type: 'NEW_MESSAGE', title_template: '{sender_name} 给您发了一条消息', body_template: '{content_preview}' },
    { event_type: 'NEW_REVIEW', title_template: '收到新评价', body_template: '{content}' },
    { event_type: 'REVIEW_REPLY', title_template: '您的评价收到回复', body_template: '{reply}' },
    { event_type: 'JOB_AUDIT', title_template: '职位审核结果', body_template: '您的职位「{job_title}」{result}，{reason}' },
    { event_type: 'COMPANY_VERIFY', title_template: '企业入驻审核结果', body_template: '您的企业「{company_name}」{result}，{reason}' },
    { event_type: 'PLAN_EXPIRE', title_template: '套餐即将到期', body_template: '您的套餐将于 {expire_date} 到期，请及时续费' },
    { event_type: 'BOOST_OVERTAKEN', title_template: '置顶被替换', body_template: '您的置顶职位「{job_title}」已被更高出价替换，当前排名已退出前 3' },
    { event_type: 'BOOST_BALANCE_LOW', title_template: '企业余额不足', body_template: '您的企业余额仅剩 {balance} 元，竞价置顶将于今日暂停' },
  ];
  for (const t of NOTIFY_TEMPLATES) {
    const tpl = await prisma.notificationTemplate.upsert({
      where: { event_type: t.event_type },
      update: {},
      create: { event_type: t.event_type, title_template: t.title_template, body_template: t.body_template },
    });
    await prisma.notificationRule.upsert({
      where: { event_type: t.event_type },
      update: {},
      create: {
        event_type: t.event_type,
        template_id: tpl.id,
        channels: t.channels || ['INAPP'],
        enabled: true,
      },
    });
  }
  console.log('通知模板/规则:', NOTIFY_TEMPLATES.length, '组');

  // ---- 企业钱包初始化（已有企业补建余额账户，balance=0） ----
  const companies = await prisma.company.findMany({ select: { id: true } });
  let walletCount = 0;
  for (const c of companies) {
    await prisma.companyWallet.upsert({
      where: { company_id: c.id },
      update: {},
      create: { company_id: c.id, balance: 0, frozen: 0, total_recharge: 0, total_consume: 0 },
    });
    walletCount++;
  }
  console.log('企业钱包:', walletCount, '个');

  // ---- 职位标签（幂等） ----
  const JOB_TAGS = [
    '五险一金', '双休', '年终奖', '带薪年假', '弹性工作',
    '加班补贴', '交通补贴', '餐饮补贴', '住房补贴', '定期体检',
    '节日福利', '团建活动', '培训机会', '晋升空间', '扁平管理',
    '补充保险', '股票期权', '免费班车', '包吃包住', '周末双休',
  ];
  const existingTags = await prisma.jobTag.count();
  if (existingTags === 0) {
    await prisma.jobTag.createMany({
      data: JOB_TAGS.map((name, i) => ({ name, sort: i })),
    });
    console.log('职位标签:', JOB_TAGS.length, '个');
  }

  // ---- 评价算法配置（幂等） ----
  const rcCount = await prisma.ratingConfig.count();
  if (rcCount === 0) {
    await prisma.ratingConfig.create({ data: {} }); // 使用 schema 默认值
    console.log('评价算法配置: 已创建（默认值）');
  }

  console.log('✅ 播种完成');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
