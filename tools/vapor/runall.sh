#!/bin/bash
# Render every part of the given scenes in the given lights.
# usage (from the repo root, with serve.mjs running): VW_WORK=<folder> bash tools/vapor/runall.sh "tt cal notes home stairs planets solids" "l d" [frames]
N=${3:-96}
HERE=$(dirname "$0")
for sc in $1; do for m in $2; do
  case $sc in
    tt) parts="plate left phone";;
    cal) parts="plate right phone";;
    notes) parts="phone";;                 # its plate is the calendar's; its picture is paint.py's
    home|solids) parts="plate left right phone";;
    stairs) parts="plate right phone";;
    planets) parts="plate planet moon phone";;
  esac
  jobs=""; for p in $parts; do jobs="$jobs scene=$sc&mode=$m&part=$p&n=$N"; done
  node "$HERE/render.mjs" $jobs 2>&1 | grep -E "wrote|TIMEOUT|ERROR" | sed 's/^/  /'
done; done
