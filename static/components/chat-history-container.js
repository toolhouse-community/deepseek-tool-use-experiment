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

  makeHtml(role, content, key) {
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
      .map(({role, content}, key) => {
        console.log('content:', content)
        return this.makeHtml(role, content, key);
      });
    if (this.thinking()) {
      msgs.push(html`<div class="fade-slide assistant"><p>Thinking…</p></div>`)
    } else if (this.getStream()) {
      msgs.push(html`<div class="assistant">${this.md.makeHtml(this.getStream())}</div>`)
    }

    return msgs;
  }
}