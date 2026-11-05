/**
 * Accessible, zero-dependency text splitting for GSAP animations.
 * Complies with strict accessibility standards (aria-label on parent,
 * split visual spans hidden from screen readers, keyboard focus unaffected).
 */

export interface SplitResult {
  lines: HTMLElement[];
  words: HTMLElement[];
  chars: HTMLElement[];
  revert: () => void;
}

export function splitText(
  element: HTMLElement,
  options: { lines?: boolean; words?: boolean; chars?: boolean } = { lines: true }
): SplitResult {
  // If already split, revert first
  if ((element as any).__wj_split_revert) {
    (element as any).__wj_split_revert();
  }

  const originalHTML = element.innerHTML;
  const originalText = element.textContent || '';
  
  // Set accessible label so screen readers read the full undisturbed sentence
  if (!element.getAttribute('aria-label')) {
    element.setAttribute('aria-label', originalText.trim());
  }
  element.setAttribute('data-wj-split-root', 'true');

  const textNodes: Text[] = [];
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null = walk.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE && currentNode.textContent?.trim()) {
      textNodes.push(currentNode as Text);
    }
    currentNode = walk.nextNode();
  }

  const createdWords: HTMLElement[] = [];
  const createdChars: HTMLElement[] = [];

  // Wrap words and chars
  for (const node of textNodes) {
    const text = node.textContent || '';
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();

    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        continue;
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = 'wj-split-word';
      wordSpan.setAttribute('aria-hidden', 'true');
      wordSpan.style.display = 'inline-block';
      wordSpan.style.whiteSpace = 'nowrap';

      if (options.chars) {
        for (const ch of part) {
          const charSpan = document.createElement('span');
          charSpan.className = 'wj-split-char';
          charSpan.setAttribute('aria-hidden', 'true');
          charSpan.style.display = 'inline-block';
          charSpan.textContent = ch;
          wordSpan.appendChild(charSpan);
          createdChars.push(charSpan);
        }
      } else {
        wordSpan.textContent = part;
      }

      fragment.appendChild(wordSpan);
      createdWords.push(wordSpan);
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  const createdLines: HTMLElement[] = [];

  // Group into lines by offsetTop if lines requested
  if (options.lines && createdWords.length > 0) {
    const lineBuckets: HTMLElement[][] = [];
    let currentBucket: HTMLElement[] = [];
    let currentTop = -9999;

    for (const word of createdWords) {
      const top = Math.round(word.offsetTop);
      if (Math.abs(top - currentTop) > 6) {
        if (currentBucket.length > 0) {
          lineBuckets.push(currentBucket);
        }
        currentBucket = [word];
        currentTop = top;
      } else {
        currentBucket.push(word);
      }
    }
    if (currentBucket.length > 0) {
      lineBuckets.push(currentBucket);
    }

    for (const bucket of lineBuckets) {
      const lineMask = document.createElement('span');
      lineMask.className = 'wj-split-line-mask';
      lineMask.setAttribute('aria-hidden', 'true');
      lineMask.style.display = 'block';
      lineMask.style.overflow = 'hidden';

      const lineInner = document.createElement('span');
      lineInner.className = 'wj-split-line';
      lineInner.setAttribute('aria-hidden', 'true');
      lineInner.style.display = 'block';

      const firstWord = bucket[0];
      const parent = firstWord.parentNode;
      if (!parent) continue;

      parent.insertBefore(lineMask, firstWord);
      lineMask.appendChild(lineInner);

      for (const word of bucket) {
        // Collect following whitespace text nodes if any
        const next = word.nextSibling;
        lineInner.appendChild(word);
        if (next && next.nodeType === Node.TEXT_NODE && /^\s+$/.test(next.textContent || '')) {
          lineInner.appendChild(next);
        }
      }
      createdLines.push(lineInner);
    }
  }

  const revert = () => {
    element.innerHTML = originalHTML;
    delete (element as any).__wj_split_revert;
  };

  (element as any).__wj_split_revert = revert;

  return {
    lines: createdLines,
    words: createdWords,
    chars: createdChars,
    revert,
  };
}
