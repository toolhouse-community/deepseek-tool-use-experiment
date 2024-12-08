import Domo, {html} from '/domo.js';

export class FizzBuzz extends Domo {
  constructor(component) {
    super(component);
    this.timer = null;
  }

  getInitialState() {
    return { count: 0, shouldAutoIncrement: false };
  }

  toggleClick() {
    this.setState({shouldAutoIncrement: !this.state.shouldAutoIncrement});
  }

  increment() {
    this.setState({count: this.state.count + 1})
  }

  stateDidChange() {
    if (!this.state.shouldAutoIncrement) {
      clearInterval(this.timer);
      this.timer = null;
    } else if (this.timer === null) {
      this.timer = setInterval(() => this.increment(), this.dataset.tickinterval);
    }
  }

  render() {
    return html`
      <input type="checkbox" ${this.state.shouldAutoIncrement ? 'checked' : ''} on-click="toggleClick" id="autoincrement" />
      <label for="autoincrement">Increment every second</label>
      <div>Count: ${'' + this.state.count}</div>
      <button on-click="increment">Count++</button>
      <div ${this.state.count == 0 ? 'hidden' : ''}>${this.state.count % 3 === 0 ? 'Fizz' : ''}${this.state.count % 5 === 0 ? 'Buzz' : ''}</div>
    `;
  }
}