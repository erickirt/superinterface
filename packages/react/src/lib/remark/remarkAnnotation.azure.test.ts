/**
 * Test remarkAnnotation with broken annotation data (Azure-style bug).
 * When annotations have non-marker text, valid markers should render as
 * annotation nodes while leftover markers are stripped and broken annotations
 * are appended at the end.
 */
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

const collectAllText = (tree: any): string => {
  const texts: string[] = []
  const walk = (node: any) => {
    if (node.type === 'text') texts.push(node.value)
    if (node.children) node.children.forEach(walk)
  }
  walk(tree)
  return texts.join('')
}

// Simulated broken annotation data: Azure-style response with overlapping/broken annotations
const brokenText =
  'The company reported strong Q3 results with revenue growth across all business segments【4:0†quarterly-report.pdf】.  \nKey highlights include a **15% increase** in cloud services, as detailed in the following reports 【4:0†quarterly-report.pdf】 【4:1†investor-deck.pdf】 :  \n  - Cloud revenue: **$2.4 billion**  \n  - Enterprise clients: **850 new contracts**  \n  - Operating margin: **22%**'

// Compute indexes dynamically to ensure correctness
const ann0Text = '【4:0†quarterly-report.pdf】'
const ann1Text =
  'a **15% increase** in cloud services, as detailed in the following reports '
const ann2Text =
  ' **15% increase** in cloud services, as detailed in the following reports 【4:0†quarterly-report.pdf】 【4:1†investor-deck'

const brokenAnnotations = [
  {
    type: 'file_citation' as const,
    text: ann0Text,
    start_index: brokenText.indexOf(ann0Text),
    end_index: brokenText.indexOf(ann0Text) + ann0Text.length,
    file_citation: { file_id: 'file-report' },
  },
  {
    type: 'file_citation' as const,
    text: ann1Text,
    start_index: brokenText.indexOf(ann1Text),
    end_index: brokenText.indexOf(ann1Text) + ann1Text.length,
    file_citation: { file_id: 'file-report' },
  },
  {
    type: 'file_citation' as const,
    text: ann2Text,
    start_index: brokenText.indexOf(ann2Text),
    end_index: brokenText.indexOf(ann2Text) + ann2Text.length,
    file_citation: { file_id: 'file-deck' },
  },
]

describe('remarkAnnotation with broken annotations', () => {
  test('annotation indexes match the text', () => {
    for (const ann of brokenAnnotations) {
      const actual = brokenText.slice(ann.start_index, ann.end_index)
      expect(actual).toBe(ann.text)
    }
  })

  test('valid marker annotation renders, broken ones appended at end', () => {
    const tree = parseWithAnnotation(brokenText, brokenAnnotations as any[])
    const annotationNodes = findNodes(tree, 'annotation')

    // 1 valid marker + 2 broken appended at end
    expect(annotationNodes).toHaveLength(3)
    // First is the valid marker
    expect(annotationNodes[0].value).toBe('【4:0†quarterly-report.pdf】')
    // Broken ones have empty value
    expect(annotationNodes[1].value).toBe('')
    expect(annotationNodes[2].value).toBe('')
  })

  test('key content preserved, leftover markers stripped', () => {
    const tree = parseWithAnnotation(brokenText, brokenAnnotations as any[])
    const allText = collectAllText(tree)

    expect(allText).toContain('The company reported strong Q3 results')
    expect(allText).toContain('15% increase')
    expect(allText).toContain('Cloud revenue')
    expect(allText).toContain('$2.4 billion')
    expect(allText).toContain('22%')
    // Leftover markers stripped
    expect(allText).not.toContain('【4:1†investor-deck.pdf】')
  })

  test('markdown structure preserved', () => {
    const tree = parseWithAnnotation(brokenText, brokenAnnotations as any[])
    const strongNodes = findNodes(tree, 'strong')
    expect(strongNodes.length).toBeGreaterThanOrEqual(1)
    const listItems = findNodes(tree, 'listItem')
    expect(listItems.length).toBeGreaterThanOrEqual(2)
  })

  test('remark offsets align with string indexes', () => {
    const tree = unified().use(remarkParse).parse(brokenText)
    const textNodes = findNodes(tree, 'text')
    for (const node of textNodes) {
      if (!node.position?.start?.offset) continue
      const fromSource = brokenText.slice(
        node.position.start.offset,
        node.position.end.offset,
      )
      expect(node.value).toBe(fromSource)
    }
  })

  test('simple valid case still works with broken detection', () => {
    const text = 'Before **bold**【4:0†file.md】 after.'
    const annText = '【4:0†file.md】'
    const startIndex = text.indexOf(annText)
    const annotation = {
      type: 'file_citation' as const,
      text: annText,
      start_index: startIndex,
      end_index: startIndex + annText.length,
      file_citation: { file_id: 'file-1' },
    }

    const rawTree = unified().use(remarkParse).parse(text)
    const textNodes = findNodes(rawTree, 'text')
    const markerNode = textNodes.find((n: any) => n.value.includes('【'))
    expect(markerNode).toBeDefined()

    if (markerNode) {
      const nodeStart = markerNode.position?.start?.offset ?? 0
      const markerPosInNode = markerNode.value.indexOf('【')
      const absoluteOffset = nodeStart + markerPosInNode
      expect(absoluteOffset).toBe(startIndex)
    }

    const tree = parseWithAnnotation(text, [annotation as any])
    const annotationNodes = findNodes(tree, 'annotation')
    expect(annotationNodes).toHaveLength(1)
    expect(annotationNodes[0].value).toBe(annText)
  })
})
