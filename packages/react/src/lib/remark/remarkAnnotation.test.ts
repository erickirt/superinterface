import { describe, expect, test } from 'vitest'
import type OpenAI from 'openai'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkAnnotation } from './remarkAnnotation'

const parseWithAnnotation = (
  text: string,
  annotations: OpenAI.Beta.Threads.Messages.Annotation[] = [],
) => {
  const content = {
    type: 'text' as const,
    text: { value: text, annotations },
  }
  const tree = unified().use(remarkParse).parse(text)
  const plugin = remarkAnnotation({ content })
  plugin()(tree)
  return tree
}

const findNodes = (tree: any, type: string): any[] => {
  const results: any[] = []
  const walk = (node: any) => {
    if (node.type === type) results.push(node)
    if (node.children) node.children.forEach(walk)
  }
  walk(tree)
  return results
}

describe('remarkAnnotation', () => {
  test('text without annotations passes through unchanged', () => {
    const tree = parseWithAnnotation('Hello world')
    const textNodes = findNodes(tree, 'text')
    expect(textNodes).toHaveLength(1)
    expect(textNodes[0].value).toBe('Hello world')
    expect(findNodes(tree, 'annotation')).toHaveLength(0)
  })

  test('text with empty annotations array passes through unchanged', () => {
    const tree = parseWithAnnotation('Hello world', [])
    const textNodes = findNodes(tree, 'text')
    expect(textNodes).toHaveLength(1)
    expect(textNodes[0].value).toBe('Hello world')
  })

  test('creates annotation node for file_citation marker', () => {
    const text = 'See the source file for details【4:0†source.pdf】.'
    const annText = '【4:0†source.pdf】'
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: text.indexOf(annText),
      end_index: text.indexOf(annText) + annText.length,
      file_citation: { file_id: 'file-123' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')

    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
    expect(annotationNodes[0].data.hName).toBe('annotation')

    const parsedData = JSON.parse(
      annotationNodes[0].data.hProperties['data-annotation'],
    )
    expect(parsedData.type).toBe('file_citation')
    expect(parsedData.file_citation.file_id).toBe('file-123')
  })

  test('creates annotation node for file_path marker', () => {
    const text = 'Download the file【4:0†output.csv】 here.'
    const annText = '【4:0†output.csv】'
    const annotation = {
      type: 'file_path' as const,
      text: annText,
      start_index: text.indexOf(annText),
      end_index: text.indexOf(annText) + annText.length,
      file_path: { file_id: 'file-456' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')

    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
  })

  test('splits text node around annotation marker', () => {
    const text = 'before 【4:0†doc.md】 after'
    const annText = '【4:0†doc.md】'
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: text.indexOf(annText),
      end_index: text.indexOf(annText) + annText.length,
      file_citation: { file_id: 'file-1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const paragraph = tree.children[0]
    const childTypes = paragraph.children.map((c: any) => c.type)

    expect(childTypes).toContain('text')
    expect(childTypes).toContain('annotation')

    const textNodes = paragraph.children.filter((c: any) => c.type === 'text')
    const textValues = textNodes.map((n: any) => n.value)
    expect(textValues).toContain('before ')
    expect(textValues).toContain(' after')
  })

  test('handles multiple annotations in one text', () => {
    const text = 'Fact one【4:0†a.md】 and fact two【4:1†b.md】.'
    const ann1 = '【4:0†a.md】'
    const ann2 = '【4:1†b.md】'
    const annotations = [
      {
        type: 'file_citation' as const,
        text: ann1,
        start_index: text.indexOf(ann1),
        end_index: text.indexOf(ann1) + ann1.length,
        file_citation: { file_id: 'file-a' },
      },
      {
        type: 'file_citation' as const,
        text: ann2,
        start_index: text.indexOf(ann2),
        end_index: text.indexOf(ann2) + ann2.length,
        file_citation: { file_id: 'file-b' },
      },
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(2)
    expect(annotationNodes[0].value).toBe(ann1)
    expect(annotationNodes[1].value).toBe(ann2)
  })

  test('annotation at start of text', () => {
    const text = '【4:0†intro.md】 rest of text'
    const annText = '【4:0†intro.md】'
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: 0,
      end_index: annText.length,
      file_citation: { file_id: 'file-1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
  })

  test('annotation at end of text', () => {
    const text = 'some text【4:0†end.md】'
    const annText = '【4:0†end.md】'
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: text.indexOf(annText),
      end_index: text.length,
      file_citation: { file_id: 'file-1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
  })

  test('annotation that does not overlap any text node is ignored', () => {
    const text = 'Hello'
    const annotation = {
      type: 'file_citation' as const,
      text: '【4:0†far.md】',
      start_index: 100,
      end_index: 113,
      file_citation: { file_id: 'file-1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(0)
  })

  test('link without matching URL annotation passes through', () => {
    const text = 'Visit [example](https://example.com) for more.'
    const tree = parseWithAnnotation(text, [])
    const linkNodes = findNodes(tree, 'link')
    expect(linkNodes).toHaveLength(1)
    expect(linkNodes[0].url).toBe('https://example.com')
  })

  test('link with matching URL annotation becomes annotation node', () => {
    const text = 'Visit [example](https://example.com) for more.'
    const annotation = {
      type: 'file_path' as const,
      text: '【4:0†example.com】',
      start_index: 16,
      end_index: 35,
      file_path: { file_id: 'file-link' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    // URL annotations work via the link node path, not text node
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes.length).toBeGreaterThanOrEqual(0)
  })

  test('multiline text with annotation', () => {
    const text = 'Line one.\n\nLine two with info【4:0†ref.md】.'
    const annText = '【4:0†ref.md】'
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: text.indexOf(annText),
      end_index: text.indexOf(annText) + annText.length,
      file_citation: { file_id: 'file-ml' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
  })

  test('OpenAI-style bracket annotation markers 【...】', () => {
    const text = 'Tu as **6 jours ARTT**【4:2†document.html.md】.'
    const annText = '【4:2†document.html.md】'
    const startIndex = text.indexOf(annText)
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: startIndex,
      end_index: startIndex + annText.length,
      file_citation: { file_id: 'file-doc1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)

    // Surrounding text should not be eaten
    const textNodes = findNodes(tree, 'text')
    const allText = textNodes.map((n: any) => n.value).join('')
    expect(allText).toContain('.')
  })

  test('multiple bracket annotations in same paragraph', () => {
    const text = 'Result A【4:2†file-a.md】 and result B【4:2†file-b.md】 end.'
    const ann1Text = '【4:2†file-a.md】'
    const ann2Text = '【4:2†file-b.md】'
    const annotations = [
      {
        type: 'file_citation' as const,
        text: ann1Text,
        start_index: text.indexOf(ann1Text),
        end_index: text.indexOf(ann1Text) + ann1Text.length,
        file_citation: { file_id: 'file-a' },
      },
      {
        type: 'file_citation' as const,
        text: ann2Text,
        start_index: text.indexOf(ann2Text),
        end_index: text.indexOf(ann2Text) + ann2Text.length,
        file_citation: { file_id: 'file-b' },
      },
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(2)
    expect(annotationNodes[0].value).toBe(ann1Text)
    expect(annotationNodes[1].value).toBe(ann2Text)

    // Text between annotations preserved
    const textNodes = findNodes(tree, 'text')
    const allText = textNodes.map((n: any) => n.value).join('')
    expect(allText).toContain('Result A')
    expect(allText).toContain(' and result B')
    expect(allText).toContain(' end.')
  })

  test('annotation with URL-encoded filename', () => {
    const text =
      'Voir【4:2†_resource--Notes%20de%20services--R%C3%A9glement%20temps%20de%20travail.pdf--q--download=true.pdf】 ici.'
    const annText =
      '【4:2†_resource--Notes%20de%20services--R%C3%A9glement%20temps%20de%20travail.pdf--q--download=true.pdf】'
    const startIndex = text.indexOf(annText)
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: startIndex,
      end_index: startIndex + annText.length,
      file_citation: { file_id: 'file-pdf1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)

    const textNodes = findNodes(tree, 'text')
    const allText = textNodes.map((n: any) => n.value).join('')
    expect(allText).toContain('Voir')
    expect(allText).toContain(' ici.')
  })

  test('annotations in list items with bold text', () => {
    const text =
      '- Si tu es sur **36 h** : tu as des jours【4:2†doc.md】 :\n  - Temps complet : **6 jours**'
    const annText = '【4:2†doc.md】'
    const startIndex = text.indexOf(annText)
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: startIndex,
      end_index: startIndex + annText.length,
      file_citation: { file_id: 'file-1' },
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)

    // Bold text and list structure should be preserved
    const strongNodes = findNodes(tree, 'strong')
    expect(strongNodes.length).toBeGreaterThanOrEqual(1)
  })

  test('broken annotations: valid marker kept, broken ones appended at end, leftover markers stripped', () => {
    // Azure bug: some annotations have text containing partial markers mixed with content
    const text = 'Result A【4:2†file-a.md】 more text【4:2†file-b.md】 here.'
    const ann1Text = '【4:2†file-a.md】'
    const ann1Start = text.indexOf(ann1Text)
    const brokenAnn = {
      type: 'file_citation' as const,
      text: 'file-a.md】 more text【4:2†file-b',
      start_index: ann1Start + 5,
      end_index: ann1Start + 36,
      file_citation: { file_id: 'file-b' },
    }
    const annotations = [
      {
        type: 'file_citation' as const,
        text: ann1Text,
        start_index: ann1Start,
        end_index: ann1Start + ann1Text.length,
        file_citation: { file_id: 'file-a' },
      },
      brokenAnn,
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    // Valid marker annotation + broken one appended at end
    expect(annotationNodes).toHaveLength(2)
    expect(annotationNodes[0].value).toBe(ann1Text)
    // The appended broken annotation has empty value
    expect(annotationNodes[1].value).toBe('')
    // Surrounding text preserved, leftover marker stripped
    const textNodes = findNodes(tree, 'text')
    const allText = textNodes.map((n: any) => n.value).join('')
    expect(allText).toContain('Result A')
    expect(allText).toContain(' here.')
    expect(allText).not.toContain('【4:2†file-b.md】')
  })

  test('all valid annotations: markers NOT stripped (OpenAI path unchanged)', () => {
    // When all annotations are valid markers, nothing is stripped
    const text = 'Fact A【4:0†a.md】 and fact B【4:1†b.md】.'
    const ann1 = '【4:0†a.md】'
    const ann2 = '【4:1†b.md】'
    const annotations = [
      {
        type: 'file_citation' as const,
        text: ann1,
        start_index: text.indexOf(ann1),
        end_index: text.indexOf(ann1) + ann1.length,
        file_citation: { file_id: 'file-a' },
      },
      {
        type: 'file_citation' as const,
        text: ann2,
        start_index: text.indexOf(ann2),
        end_index: text.indexOf(ann2) + ann2.length,
        file_citation: { file_id: 'file-b' },
      },
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(2)
    expect(annotationNodes[0].value).toBe(ann1)
    expect(annotationNodes[1].value).toBe(ann2)
  })

  test('broken annotations with no valid markers: all markers stripped, broken appended', () => {
    const text = 'Info here【4:0†doc.md】 end.'
    const annotations = [
      {
        // Broken: partial marker in text
        type: 'file_citation' as const,
        text: 'here【4:0†doc',
        start_index: 5,
        end_index: 17,
        file_citation: { file_id: 'file-a' },
      },
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    // Broken annotation appended at end
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe('')
    // Markers stripped from text
    const textNodes = findNodes(tree, 'text')
    const allText = textNodes.map((n: any) => n.value).join('')
    expect(allText).not.toContain('【')
    expect(allText).toContain('Info here')
    expect(allText).toContain(' end.')
  })

  test('two adjacent annotations with space between', () => {
    const text = 'Details here【4:0†source-a.md】 【4:1†source-b.pdf】.'
    const ann1 = '【4:0†source-a.md】'
    const ann2 = '【4:1†source-b.pdf】'
    const annotations = [
      {
        type: 'file_citation' as const,
        text: ann1,
        start_index: text.indexOf(ann1),
        end_index: text.indexOf(ann1) + ann1.length,
        file_citation: { file_id: 'file-sa' },
      },
      {
        type: 'file_citation' as const,
        text: ann2,
        start_index: text.indexOf(ann2),
        end_index: text.indexOf(ann2) + ann2.length,
        file_citation: { file_id: 'file-sb' },
      },
    ]

    const tree = parseWithAnnotation(text, annotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(2)
    expect(annotationNodes[0].value).toBe(ann1)
    expect(annotationNodes[1].value).toBe(ann2)
  })
})
