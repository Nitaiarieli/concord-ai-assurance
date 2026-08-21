export class DeterministicMinHeap<T> {
  private values: T[] = [];
  private readonly compare: (left: T, right: T) => number;
  constructor(compare: (left: T, right: T) => number) { this.compare = compare; }
  get size() { return this.values.length; }
  push(value: T) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.values[parent], this.values[index]) <= 0) break;
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }
  pop(): T | null {
    if (!this.values.length) return null;
    const root = this.values[0];
    const tail = this.values.pop()!;
    if (this.values.length) {
      this.values[0] = tail;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.values.length && this.compare(this.values[left], this.values[smallest]) < 0) smallest = left;
        if (right < this.values.length && this.compare(this.values[right], this.values[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        [this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]];
        index = smallest;
      }
    }
    return root;
  }
}
