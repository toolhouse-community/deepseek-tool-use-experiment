import Domo, {html} from '/domo.js';

export class ChatHistoryContainer extends Domo {
  constructor(component) {
    super(component);
  }

  render() {
    return this.getHistory().map(({role, message}) =>
      html`<div class="${role}">${message}</div>`
    );
  }
}