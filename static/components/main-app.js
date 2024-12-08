import Domo, {html} from '/domo.js';

export class MainApp extends Domo {
  constructor(component) {
    super(component);
  }

  getInitialState() {
    return { 
      messages: [
        {
          role: 'user',
          message: 'hello'
        },
        {
          role: 'assistant',
          message: 'world',
        }
      ], 
      streamingResponse: null
    };
  }

  async messageCallback(value) {
    console.log(value.trim())
  }

  getMessages() {
    return this.state.messages;
  }

  render() {
    return html`
      <chat-history-container cb-get-history=${this.getMessages} />
      <resizable-textarea cb-enter-handler=${this.messageCallback} />
    `;
  }
}