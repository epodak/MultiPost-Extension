import type { DynamicData, SyncData } from '../common';

export async function DynamicTaobao(data: SyncData) {
  const { title, content, images } = data.data as DynamicData;

  // 辅助函数：等待元素出现
  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // 辅助函数：等待多个元素出现
  function waitForElements(selector: string, count: number, timeout = 30000): Promise<Element[]> {
    return new Promise((resolve, reject) => {
      const checkElements = () => {
        const elements = document.querySelectorAll(selector);
        if (elements.length >= count) {
          resolve(Array.from(elements));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`未能在 ${timeout}ms 内找到 ${count} 个 "${selector}" 元素`));
          return;
        }

        setTimeout(checkElements, 100);
      };

      const startTime = Date.now();
      checkElements();
    });
  }

  // 辅助函数：上传文件
  async function uploadFiles(files: File[]) {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
    if (!fileInput) {
      console.error('未找到文件输入元素');
      return;
    }

    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.debug('文件上传操作完成');
  }

  try {
    // 等待商品标题输入框出现
    const titleInput = (await waitForElement('#title')) as HTMLInputElement;
    if (titleInput) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('商品标题已填写');
    }

    // 填写商品描述
    const descEditor = (await waitForElement('#description')) as HTMLTextAreaElement;
    if (descEditor) {
      descEditor.value = content;
      descEditor.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('商品描述已填写');
    }

    // 处理图片上传
    if (images && images.length > 0) {
      const imageFiles = await Promise.all(
        images.map(async (file) => {
          const response = await fetch(file.url);
          const blob = await response.blob();
          return new File([blob], file.name, { type: file.type });
        }),
      );
      await uploadFiles(imageFiles);

      // 等待图片上传完成
      try {
        await waitForElements('.upload-success', images.length, 60000);
        console.log(`成功上传 ${images.length} 张商品图片`);
      } catch (error) {
        console.error('图片上传可能未完成:', error);
      }
    }

    // 等待内容加载
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 自动发布
    if (data.auto_publish) {
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const publishButton = (await waitForElement('#J_PublishBtn', 5000)) as HTMLButtonElement;
          publishButton.click();
          console.log('发布按钮已点击');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          break; // 成功点击后退出循环
        } catch (error) {
          console.warn(`第 ${attempt + 1} 次尝试查找发布按钮失败:`, error);
          if (attempt === maxAttempts - 1) {
            console.error('达到最大尝试次数，无法找到发布按钮');
          }
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒后重试
        }
      }
    }
  } catch (error) {
    console.error('淘宝商品发布过程中出错:', error);
  }
}