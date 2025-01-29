import Domo, { html } from "/app/domo.js";
import { StreamProcessor } from "/app/helpers/stream.js";

export class MainApp extends Domo {
  constructor(component) {
    super(component);
    this.firstRender = true;
  }

  getInitialState() {
    this.setupStream();
    const state = {
      messages: [],
      thinking: false,
      streamingResponse: "",
      formIsHidden: false,
      email: "",
      configured: false,
    };

    return state;
  }

  setupStream() {
    this.processor = new StreamProcessor("/api/chat");
    this.processor.addEventListener("chunk", (event) => {
      this.setState({
        thinking: false,
        streamingResponse: this.state.streamingResponse + event.detail,
      });
    });

    this.processor.addEventListener("end", (event) => {
      const messages = JSON.parse(event.detail);
      const lastMessage = JSON.stringify(messages.at(-1));
      this.setState({ streamingResponse: "", messages: messages });
    });
  }

  handleMessageSubmission(value) {
    if (value.trim().length === 0) {
      return;
    }
    const messages = this.state.messages;
    messages.push({ role: "user", content: value.trim() });
    this.setState({ messages: messages, thinking: true });

    const postData = {
      messages: this.state.messages,
    };

    console.log(postData);
    this.processor.processStream(postData);
  }

  getMessages() {
    return this.state.messages;
  }
  getStreamingResponse() {
    if (this.state.streamingResponse.includes("<think>") && this.state.streamingResponse.includes("</think>")) {
      return this.state.streamingResponse.replace(/<think>.*?<\/think>/gs, "").trim();
    } if (this.state.streamingResponse.includes("<think>")) {
      return "";
    }
  }
  thinking() {
    return this.state.thinking;
  }

  submitPreferences({ email, preferences }) {
  }

  componentDidRender() {
    this.firstRender = false;
  }

  render() {
    return html`
      <div style="display: flex">
        <toolhouse-icon />
        <h1 style="flex:1">DeepSeek + Toolhouse</h1>
      </div>

      ${this.state.configured && this.firstRender ? `<success-message />` : ""}
      <chat-history-container
        data-provider="openai"
        data-len="${this.state.messages.length}"
        cb-thinking=${this.thinking}
        cb-get-history=${this.getMessages}
        cb-get-stream=${this.getStreamingResponse}
      />
      <action-box
        data-hidden="${this.state.configured === false}"
        cb-action-handler=${this.handleMessageSubmission}
      />
      <resizable-textarea cb-enter-handler=${this.handleMessageSubmission} />
    `;
  }
}
