import { useState } from 'react';

interface DropInfo {
  idx: number;
  before: boolean;
}

/**
 * Reusable drag-to-reorder for any array displayed in a table.
 * Call dragProps(idx) on each <tr> to get the event handlers.
 * Call rowClass(idx, base?) to get the correct className.
 */
export function useDragSort<T>(
  items: T[],
  onReorder: (newItems: T[]) => void
) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);

  function dragProps(idx: number) {
    return {
      draggable: true as const,

      onDragStart(e: React.DragEvent) {
        setDragIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => {
          (e.currentTarget as HTMLElement).style.opacity = '0.35';
        });
      },

      onDragEnd(e: React.DragEvent) {
        (e.currentTarget as HTMLElement).style.opacity = '';
        setDragIdx(null);
        setDropInfo(null);
      },

      onDragOver(e: React.DragEvent) {
        if (dragIdx === null) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        setDropInfo(prev =>
          prev?.idx === idx && prev?.before === before ? prev : { idx, before }
        );
      },

      onDragLeave() {
        setDropInfo(prev => (prev?.idx === idx ? null : prev));
      },

      onDrop(e: React.DragEvent) {
        e.preventDefault();
        if (dragIdx === null || dropInfo === null) return;
        const next = [...items];
        const [item] = next.splice(dragIdx, 1);
        let at = dropInfo.before ? dropInfo.idx : dropInfo.idx + 1;
        if (dragIdx < at) at--;
        next.splice(at, 0, item);
        onReorder(next);
        setDragIdx(null);
        setDropInfo(null);
      },
    };
  }

  function rowClass(idx: number, base = '') {
    const parts = [base];
    if (dragIdx === idx) parts.push('dragging');
    if (dropInfo?.idx === idx) parts.push(dropInfo.before ? 'drag-before' : 'drag-after');
    return parts.filter(Boolean).join(' ');
  }

  return { dragProps, rowClass };
}
