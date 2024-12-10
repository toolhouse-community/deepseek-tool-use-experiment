import Domo, {html} from '/domo.js';

export class GenericIcon extends Domo {
  render() {
    switch (this.getAttribute("icon")) {
      case 'mealplanner':
        return html`<utensils-crossed-icon />`;
      case 'x-digest':
        return html`<twitter-icon />`;
    }
  }
}