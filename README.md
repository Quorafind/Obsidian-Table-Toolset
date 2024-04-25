# Obsidian Table Toolset

- Support render multi line in table editor.
- Support toggle checkbox in table editor.
- Support render formula in table editor.
	- MAX: `=MAX(A2:A4)` | `=MAX(A:B)` | `=MAX(1:3)`
	- MIN: `=MIN(A2:A4)` | `=MIN(A:B)` | `=MIN(1:3)`
	- SUM: `=SUM(A2:A4)` | `=SUM(A:B)` | `=SUM(1:3)`
	- SUMIF: `=SUMIF(A2:A4,">50")` | `=SUMIF(A:B,">50")` | `=SUMIF(1:3,">50")`
	- [NOT available now] IF: `=IF(A2>50,"Pass","Fail")` | `=IF(A>50,"Pass","Fail")` | `=IF(1>50,"Pass","Fail")`

# Usage

- Install and enable this plugin.
- Type in a table cell, when you want to create new line, type shift + enter(Obsidian support).
- Use any multiline syntax you want(Plugin support).

like

```markdown
| a | b | c |
| - | - | - |
| - abcd<br>- abcd | - abcd<br>- abcd | - abcd<br>- abcd |
```

And the list in table cell will render as Obsidian support.

# Style

You can use table toolset to create column style. Add `columns-table` to cssclasses in file;


