import type { ArticleData, SyncData } from '~sync/common';

/**
 * 知乎文章发布函数
 * @param data - 同步数据对象，包含文章内容和发布配置
 */
export async function ArticleZhihu(data: SyncData) {
  console.debug('ArticleZhihu', data);

  /**
   * 等待指定选择器的元素出现
   * @param selector - CSS选择器
   * @param timeout - 超时时间（毫秒）
   * @returns Promise<Element> - 返回找到的元素
   */
  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      // 首先检查元素是否已存在
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      // 创建观察器监听DOM变化
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      // 配置观察器
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // 设置超时处理
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  const articleData = data.data as ArticleData;

  // 新增数据详情日志
  console.debug('ArticleData详情:', {
    title: articleData.title,
    contentLength: articleData.originContent?.length || 0,
    contentPreview: articleData.originContent?.substring(0, 100) + '...',
    hasCover: !!articleData.cover,
    // 添加更多字段检查
    content: articleData.content?.length || 0,
    markdownContent: articleData.markdownContent?.length || 0,
    // 移除不存在的htmlContent属性
  });

  /**
   * 处理文章内容，转换为HTML格式
   * @param content - 原始文章内容
   * @returns Promise<string> - 处理后的HTML内容
   */
  async function processContent(content: string): Promise<string> {
    if (!content || content.trim() === '') {
      console.debug('内容为空，尝试使用其他可用内容字段');
      // 尝试使用其他可能的内容字段
      content = articleData.content ||
                articleData.markdownContent ||
                // 移除不存在的htmlContent属性
                '<p>内容为空</p>';
    }

    console.debug('处理前的内容长度:', content.length);
    console.debug('内容预览:', content.substring(0, 100));

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    // 知乎文章编辑器会自动处理图片上传，所以这里不需要预处理图片
    return doc.body.innerHTML;
  }

  /**
   * 填充文章标题和内容
   * @returns Promise<boolean> - 填充是否成功
   */
  async function fillArticleContent() {
    // 等待标题输入框出现
    const titleTextarea = (await waitForElement(
      'textarea[placeholder="请输入标题（最多 100 个字）"]',
    )) as HTMLTextAreaElement;
    if (!titleTextarea) {
      console.debug('未找到标题输入框');
      return false;
    }

    // 设置标题
    titleTextarea.value = articleData.title?.slice(0, 100) || '';
    titleTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    titleTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    console.debug('titleTextarea', titleTextarea, titleTextarea.value);

    // 等待编辑器加载
    const editor = (await waitForElement('div[data-contents="true"]')) as HTMLDivElement;
    if (!editor) {
      console.debug('未找到编辑器元素');
      return false;
    }

    // 处理并填充内容
    const processedContent = await processContent(articleData.originContent || articleData.content || articleData.markdownContent || '');
    console.debug('处理后的内容长度:', processedContent.length);
    console.debug('处理后内容预览:', processedContent.substring(0, 100));

    editor.focus();

    // 使用粘贴事件插入内容
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    pasteEvent.clipboardData.setData('text/html', processedContent);
    editor.dispatchEvent(pasteEvent);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 5000));
    return true;
  }

  /**
   * 上传文章封面图片
   * @returns Promise<boolean> - 上传是否成功
   */
  async function uploadCover() {
    if (!articleData.cover) {
      console.debug('没有封面图片需要上传');
      return true;
    }

    console.debug('开始尝试上传封面图片:', articleData.cover);

    try {
      // 等待上传按钮出现
      const uploadButton = await waitForElement('.UploadPicture-wrapper');
      console.debug('找到上传按钮元素:', uploadButton);

      // 点击上传按钮以触发文件选择器
      uploadButton.dispatchEvent(new Event('click', { bubbles: true }));

      // 等待文件输入元素出现
      const fileInput = (await waitForElement('input[type="file"].UploadPicture-input')) as HTMLInputElement;
      if (!fileInput) {
        console.debug('未找到文件输入元素');
        return false;
      }

      const coverFile = articleData.cover;
      const dataTransfer = new DataTransfer();
      console.debug('准备上传文件:', coverFile);

      // 获取图片数据
      const response = await fetch(coverFile.url);
      if (!response.ok) {
        throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], coverFile.name, { type: coverFile.type });

      dataTransfer.items.add(file);
      console.debug('文件已添加到DataTransfer');

      if (dataTransfer.files.length > 0) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.debug('文件上传事件已触发');

        // 等待上传完成的标志（可能需要根据实际DOM结构调整）
        try {
          await waitForElement('.Image-PreviewImage', 15000);
          console.debug('检测到图片预览元素，上传可能已完成');
        } catch {
          console.debug('等待图片预览元素超时，但继续执行');
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      return true;
    } catch (error) {
      console.error('上传封面图片失败:', error);
      return false;
    }
  }

  /**
   * 发布文章
   * @returns Promise<void>
   */
  async function publishArticle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const buttons = document.querySelectorAll('button');
    const publishButton = Array.from(buttons).find((button) => button.textContent?.includes('发布'));

    console.debug('publishButton', publishButton);

    if (!publishButton) {
      console.debug('未找到"发布"按钮');
      return;
    }

    if (data.auto_publish) {
      console.debug('publishButton clicked');
      publishButton.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  // 主流程
  try {
    const contentFilled = await fillArticleContent();
    if (!contentFilled) {
      throw new Error('填充文章内容失败');
    }

    const coverUploaded = await uploadCover();
    if (!coverUploaded) {
      throw new Error('上传封面图片失败');
    }

    await publishArticle();
  } catch (error) {
    console.error('发布文章失败:', error);
  }
}
