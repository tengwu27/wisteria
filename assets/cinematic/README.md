# Cinematic Asset Sources

This tree contains only editable inputs for the cinematic village. Approved
encoded output lives in `public/media/village`, which is the single source for
browser-delivered video.

```text
village/
  ambient/
    sources/                  painted day/night source frames
  interactions/<object>/
    sources/                  aligned closed/interior endpoint frames
    masks/                    optional mechanical-motion masks
```

Only approved delivery copies belong in `public/media/village`. Generated or
superseded renders are removed from the working tree and remain recoverable
from Git history instead of being kept in parallel source or archive trees.
