# Native table ownership

The opt-in resolver uses PDF structure tags to bind an answer to an explicit
cell. The question must uniquely identify the row. Tables wider than two columns
also require a unique matching column header. Missing cells, spans, conflicting
rows, and multiple matching options cause abstention. It never infers membership
from an absent option or joins neighboring cells into an answer.
