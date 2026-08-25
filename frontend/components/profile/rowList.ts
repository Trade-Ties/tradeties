"use client";

import { useState } from "react";

import { nextKey } from "./constants";

/**
 * The editing state a list of rows needs, for the two steps that have one.
 *
 * Services and licences are the same screen with a different noun: a list of rows, one open at
 * a time, a cursor to place in whatever was just created, and add / remove / edit. What is not
 * here is anything either list decides for itself — what a row is, what makes two of them
 * clash, and how the row reads on screen.
 */

/** Everything this needs of a row: a key of its own, which React needs before the server has one. */
export interface KeyedRow {
  key: number;
}

export interface RowList<Row extends KeyedRow> {
  openId: number | null;
  /** The row whose first field should take the cursor — set only for one just created. */
  focusId: number | null;
  /** Adds a row at the end, opens it, and puts the cursor in it. */
  add: (make: (key: number) => Row) => void;
  insertAfter: (index: number, make: (key: number) => Row) => void;
  remove: (key: number) => void;
  edit: <K extends keyof Row>(key: number, field: K, value: Row[K]) => void;
  /** Opens a row, or closes it if it is the open one. */
  toggle: (key: number) => void;
}

export function useRowList<Row extends KeyedRow>(
  rows: Row[],
  update: (rows: Row[]) => void
): RowList<Row> {
  const [openId, setOpenId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);

  const openNew = (row: Row, at: number) => {
    const next = [...rows];
    next.splice(at, 0, row);
    update(next);
    setOpenId(row.key);
    setFocusId(row.key);
  };

  return {
    openId,
    focusId,

    add: (make) => openNew(make(nextKey(rows)), rows.length),
    insertAfter: (index, make) => openNew(make(nextKey(rows)), index + 1),

    remove: (key) => {
      update(rows.filter((row) => row.key !== key));
      if (openId === key) setOpenId(null);
    },

    edit: (key, field, value) =>
      update(rows.map((row) => (row.key === key ? { ...row, [field]: value } : row))),

    toggle: (key) => {
      setOpenId(openId === key ? null : key);
      // The cursor belongs in the first field of a row that was just created, not of one
      // reopened later by hand.
      setFocusId(null);
    },
  };
}
