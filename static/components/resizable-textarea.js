import Domo, {html} from '/app/domo.js';

export class ResizableTextarea extends Domo {
  constructor(component) {
    super(component);
  }
  
  autoResizeTextbox(e) {
    if (this.textbox.scrollHeight > this.textbox.offsetHeight) {
      this.textbox.style.height = this.textbox.scrollHeight + 'px';
    }
  }
  
  maybeSubmit(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      super.setState({chatValue: e.target.value});
      this.enterHandler(e.target.value);
      e.target.value = '';
      this.textbox.style.height = this.initialHeight;
    } else if (e.key === 'Enter' && (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.target.value += '\n';
      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
      this.autoResizeTextbox(e);
    }
  }

  componentDidRender() {
    this.textbox = this.querySelector('#auto-resize-textbox');
    this.initialHeight = this.textbox.initialHeight + 'px';
    setTimeout(() => {
      this.textbox.focus();
    }, 100);
  }
  
  render() {
    return html`
      <textarea on-input="autoResizeTextbox" on-keydown="maybeSubmit" id="auto-resize-textbox" placeholder="Type something…"></textarea>
    `;
  }
}