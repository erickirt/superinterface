import { Paragraph } from './Paragraph'
import { Link } from './Link'
import { UnorderedList } from './UnorderedList'
import { OrderedList } from './OrderedList'
import { ListItem } from './ListItem'
import { Strong } from './Strong'
import { Pre } from './Pre'

export const components = {
  p: Paragraph,
  a: Link,
  strong: Strong,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  pre: Pre,
}
