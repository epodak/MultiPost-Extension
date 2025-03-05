import { ArticleInfoMap } from './article';
import { DynamicInfoMap } from './dynamic';
import { VideoInfoMap } from './video';

// 同步数据接口定义
export interface SyncData {
  platforms: string[];  // 平台列表
  auto_publish: boolean;  // 是否自动发布
  data: DynamicData | ArticleData | VideoData;  // 发布内容数据
}

// 动态内容数据接口
export interface DynamicData {
  title: string;  // 标题
  content: string;  // 内容
  images: FileData[];  // 图片列表
  videos: FileData[];  // 视频列表
}

// 文件数据接口
export interface FileData {
  name: string;  // 文件名
  url: string;  // 文件URL
  type: string;  // 文件类型
  size: number;  // 文件大小
  base64?: string;  // Base64编码
  originUrl?: string;  // 原始URL
}

// 文章数据接口
export interface ArticleData {
  title: string;  // 标题
  content: string;  // 内容
  digest: string;  // 摘要
  cover: FileData;  // 封面图
  images: FileData[];  // 图片列表
  videos: FileData[];  // 视频列表
  fileDatas: FileData[];  // 文件列表
  originContent?: string;  // 原始内容
  markdownContent?: string;  // Markdown内容
  markdownOriginContent?: string;  // 原始Markdown内容
}

// 视频数据接口
export interface VideoData {
  title: string;  // 标题
  content: string;  // 内容
  video: FileData;  // 视频文件
}

// 平台信息接口
export interface PlatformInfo {
  type: 'DYNAMIC' | 'VIDEO' | 'ARTICLE';  // 平台类型
  name: string;  // 平台名称
  homeUrl: string;  // 主页URL
  faviconUrl?: string;  // 网站图标URL
  iconifyIcon?: string;  // Iconify图标
  platformName: string;  // 平台显示名称
  username?: string;  // 用户名
  userAvatarUrl?: string;  // 用户头像URL
  injectUrl: string;  // 注入URL
  injectFunction: (data: SyncData) => Promise<void>;  // 注入函数
}

// 平台信息映射表
export const infoMap: Record<string, PlatformInfo> = {
  ...DynamicInfoMap,
  ...ArticleInfoMap,
  ...VideoInfoMap,
};

// 获取默认平台信息
export function getDefaultPlatformInfo(platform: string): PlatformInfo | null {
  return infoMap[platform] || null;
}

// 获取平台信息列表
export function getPlatformInfos(type?: 'DYNAMIC' | 'VIDEO' | 'ARTICLE'): PlatformInfo[] {
  if (!type) return Object.values(infoMap);
  return Object.values(infoMap).filter((info) => info.type === type);
}

// Inject || 注入 || START
// 为平台创建标签页
export async function createTabsForPlatforms(data: SyncData) {
  const tabs = [];
  for (const platform of data.platforms) {
    const info = getDefaultPlatformInfo(platform);
    if (info) {
      const tab = await chrome.tabs.create({ url: info.injectUrl });
      tabs.push([tab, platform]);
    }
  }

  const groupId = await chrome.tabs.group({ tabIds: tabs.map((t) => t[0].id!) });
  const group = await chrome.tabGroups.get(groupId);

  await chrome.tabGroups.update(group.id, {
    color: 'blue',
    title: `MultiPost-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
  });

  return tabs;
}

// 向标签页注入脚本
export async function injectScriptsToTabs(tabs: [chrome.tabs.Tab, string][], data: SyncData) {
  for (const t of tabs) {
    const tab = t[0];
    const platform = t[1];
    if (tab.id) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          const info = getDefaultPlatformInfo(platform);
          if (info) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: info.injectFunction,
              args: [data],
            });
          }
        }
      });
    }
  }
}
// Inject || 注入 || END
