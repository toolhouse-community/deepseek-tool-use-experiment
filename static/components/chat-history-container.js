import Domo, {html} from '/domo.js';

export class ChatHistoryContainer extends Domo {
  constructor(component) {
    super(component);
  }

  render() {
    const msgs = this.getHistory().map(({role, content}) =>
      html`<div class="${role}">${Array.isArray(content) ? content.find(c => c.type === 'text').text : content}</div>`
    );
    if (this.getStream()) {
      msgs.push(html`<div class="assistant">${this.getStream()}</div>`)
    }

    return msgs;
  }
}