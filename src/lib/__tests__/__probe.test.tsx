import { it, vi, expect } from 'vitest';
const h = vi.hoisted(() => ({ bufs: [] as any[] }));
vi.mock('jspdf', async (orig) => {
  const mod: any = await orig();
  const Real = mod.default;
  class CapturePDF extends Real {
    save(_name?: string) { h.bufs.push('saved:' + (typeof this.output)); return this; }
  }
  return { ...mod, default: CapturePDF };
});
import jsPDF from 'jspdf';
it('probe: default é CapturePDF?', () => {
  const d: any = new jsPDF();
  d.save('x.pdf');
  console.log('bufs:', h.bufs, '| ctor:', d.constructor.name);
  expect(h.bufs.length).toBe(1);
});
