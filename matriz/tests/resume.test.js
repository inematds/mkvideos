'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { failedSlugs } = require('../lib/resume');

test('failedSlugs retorna slugs com status failed ou pending', () => {
  const summary = {
    videos: [
      { slug: 'a', status: 'done' },
      { slug: 'b', status: 'failed' },
      { slug: 'c', status: 'pending' },
      { slug: 'd', status: 'done' },
    ],
  };
  assert.deepStrictEqual(failedSlugs(summary).sort(), ['b', 'c']);
});

test('failedSlugs com summary todo done retorna []', () => {
  const summary = { videos: [{ slug: 'a', status: 'done' }] };
  assert.deepStrictEqual(failedSlugs(summary), []);
});

test('failedSlugs preserva ordem original', () => {
  const summary = {
    videos: [
      { slug: 'b', status: 'failed' },
      { slug: 'a', status: 'failed' },
    ],
  };
  assert.deepStrictEqual(failedSlugs(summary), ['b', 'a']);
});
