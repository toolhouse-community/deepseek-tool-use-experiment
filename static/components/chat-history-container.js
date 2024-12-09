import Domo, {html} from '/domo.js';

export class ChatHistoryContainer extends Domo {
  constructor(component) {
    super(component);
    this.md = new showdown.Converter({
      smoothLivePreview: true,
      openLinksInNewWindow: true,
      emoji: true,
      underline: true,
      strikethrough: true,
    });

    this.md.setFlavor('github');
    this.animations = new Set()
  }

  makeHtml(chat) {
    switch (this.dataset.provider) {
      case 'anthropic':
        return this.makeHtmlAnthropic(chat.role, chat.content);
      case 'openai':
        return this.makeHtmlOpenAI(chat);
    }
  }

  makeHtmlOpenAI({ role, content, tool_calls}) {
    if (content) {
      return html`<div class="${role}">${this.md.makeHtml(content)}</div>`;
    } else if (Array.isArray(tool_calls)) {
      const bubbles = tool_calls.map((c) =>
        `<div class="${role}">
          <h4>Using tools</h4>
          <p>${c.function.name}(${c.function.arguments != '{}' ? c.function.arguments : ''})</p>
        </div>`
      ).join('');

      return html`${bubbles}`;
    }
  }

  makeHtmlAnthropic(role, content) {
    let bubbles = '';
    if (Array.isArray(content)) {
      content.forEach((c) => {
        switch(c.type) {
          case 'text':
            if (c.text) {
              bubbles += `<div class="${role}">${this.md.makeHtml(c.text)}</div>`;
            }
            break;
          case 'tool_use':
            bubbles += `
              <div class="${role}">
                <h4>Using tools</h4>
                <p>${c.name}(${JSON.stringify(c.input) !== '{}' ? JSON.stringify(c.input) : ''})</p>
              </div>`;
            break;
        }
      });
      return html`${bubbles}`;
    } else {
      return html`<div class="${role}">${this.md.makeHtml(content)}</div>`;
    }
  }

  componentDidRender() {
    this.scrollTop = this.scrollHeight;
  }

  render() {
    const msgs = this.getHistory()
      .filter(({role}) => ['user', 'assistant'].includes(role))
      .map((chat) => {
        return this.makeHtml(chat);
      });
    if (this.thinking()) {
      msgs.push(html`<div class="fade-slide assistant"><p>Thinking…</p></div>`)
    } else if (this.getStream()) {
      msgs.push(html`<div class="assistant">${this.md.makeHtml(this.getStream())}</div>`)
    }

    return msgs;
  }
}