/**
 * Markdown渲染组件
 * 用于将Markdown文本渲染为微信小程序可显示的格式
 */
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // Markdown文本内容
    content: {
      type: String,
      value: '',
      observer: function(newVal) {
        if (newVal) {
          this._parseMd();
        }
      }
    },
    // 是否使用自定义样式
    useCustomStyle: {
      type: Boolean,
      value: true
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    nodes: []
  },

  /**
   * 组件生命周期函数
   */
  lifetimes: {
    attached: function() {
      if (this.data.content) {
        this._parseMd();
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 解析Markdown为rich-text所需的nodes格式
    _parseMd: function() {
      const md = this.data.content;
      if (!md) return;

      try {
        // 简单的Markdown解析
        let html = this._convertMarkdownToHtml(md);
        
        // 设置自定义样式
        if (this.data.useCustomStyle) {
          html = this._addCustomStyles(html);
        }
        
        this.setData({
          nodes: html
        });
      } catch (e) {
        console.error('Markdown解析错误', e);
        // 如果解析失败，显示原始文本
        this.setData({
          nodes: md
        });
      }
    },

    // 简单的Markdown转HTML实现
    _convertMarkdownToHtml: function(md) {
      // 替换标题
      let html = md.replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>');
      
      // 替换粗体
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // 替换斜体
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // 替换链接
      html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      
      // 替换无序列表
      html = html.replace(/^\s*[-+*]\s+(.*$)/gm, '<li>$1</li>');
      html = html.replace(/<li>(.*?)<\/li>(?:\s*<li>)/g, '<li>$1</li><li>');
      html = html.replace(/<li>(.*?)(?:\s*<\/li>)/g, '<ul><li>$1</li></ul>');
      html = html.replace(/<\/ul>\s*<ul>/g, '');
      
      // 替换有序列表
      html = html.replace(/^\s*(\d+)\.\s+(.*$)/gm, '<li>$2</li>');
      
      // 替换代码块
      html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      
      // 替换行内代码
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      
      // 替换段落
      html = html.replace(/^(?!<[a-z]).+/gm, '<p>$&</p>');
      
      // 替换换行
      html = html.replace(/\n/g, '<br>');
      
      return html;
    },

    // 添加自定义样式
    _addCustomStyles: function(html) {
      // 添加样式类
      html = html.replace(/<h1>/g, '<h1 class="md-h1">');
      html = html.replace(/<h2>/g, '<h2 class="md-h2">');
      html = html.replace(/<h3>/g, '<h3 class="md-h3">');
      html = html.replace(/<p>/g, '<p class="md-p">');
      html = html.replace(/<ul>/g, '<ul class="md-ul">');
      html = html.replace(/<li>/g, '<li class="md-li">');
      html = html.replace(/<code>/g, '<code class="md-code">');
      html = html.replace(/<pre>/g, '<pre class="md-pre">');
      
      return html;
    }
  }
}) 