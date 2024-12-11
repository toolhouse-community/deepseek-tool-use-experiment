import Domo, {html} from '/static/domo.js';

export class GenericIcon extends Domo {
  render() {
    switch (this.getAttribute("icon")) {
      case 'mealplanner':
        return html`<utensils-crossed-icon />`;
      case 'news-digest':
        return html`<newspaper-icon />`;
      case 'random-pet-fact':
        return html`<random-pet-icon />`;
      case 'x-digest':
        return html`<twitter-icon />`;
    }
  }
}