# cine3d

Motore per shot 3D cinematografici: una piccola spec JSON per inquadratura, resa con Remotion + three.js
(profondità di campo, bloom, alone, tone mapping ACES, grana, vignettatura).

## Uso

    npm i
    node tools/c3d.mjs sheet shots/hero.json            # foglio di controllo: out/hero_sheet.jpg
    node tools/c3d.mjs render shots/hero.json           # out/hero.mp4
    node tools/c3d.mjs render shots/a.json shots/b.json --out out/film.mp4 --audio traccia.mp3

Opzioni: `--draft` (480p veloce). Variabili: `C3D_BROWSER` (percorso di Chrome), `C3D_GL` (angle, swangle, swiftshader), `C3D_LOG=verbose`.

Il formato della spec è descritto nella skill `cine3d-shot`. `shots/hero.json` è il modello da copiare.

Richiede Node 18+. Remotion è gratuito per individui e organizzazioni fino a tre persone; oltre serve una licenza aziendale.
