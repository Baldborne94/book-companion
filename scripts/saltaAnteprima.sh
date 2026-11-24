#!/bin/sh
# IL PASSO «IGNORED BUILD STEP» DI VERCEL (`ignoreCommand` in vercel.json):
# esce con 0 e Vercel salta la build, con 1 e la fa. Le anteprime dei rami
# di lavoro `claude/*` non si pubblicano: le prove le rifà la CI prima del
# merge, e ogni anteprima era una copia intera dell'app (36 MB, 28 del
# Wiktionary) che contava nello spazio gratuito di Vercel, riempito.
case "$VERCEL_GIT_COMMIT_REF" in
  claude/*) echo "anteprima del ramo $VERCEL_GIT_COMMIT_REF: saltata"; exit 0 ;;
  *) exit 1 ;;
esac
