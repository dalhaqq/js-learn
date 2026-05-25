/**
 * @file Lesson groups — curriculum tree structure.
 *
 * Each group maps to a topic and contains ordered exercise IDs.
 * The order determines the recommended learning path through that topic.
 */

import { LessonGroup } from '../types';

export const GROUPS: LessonGroup[] = [
  {
    id: 'basics',
    title: 'Dasar JavaScript (8)',
    topic: 'basics',
    exercises: [
      'basics-variables-001',
      'basics-conditions-002',
      'basics-loops-003',
      'basics-functions-004',
      'basics-strings-005',
      'basics-arrays-006',
      'basics-objects-007',
      'basics-template-008',
    ],
  },
  {
    id: 'async',
    title: 'Async & Promise',
    topic: 'async',
    exercises: [
      'async-callback-001',
      'async-promise-002',
      'async-await-003',
      'async-concepts-004',
    ],
  },
  {
    id: 'dom',
    title: 'DOM Manipulasi (5)',
    topic: 'dom',
    exercises: [
      'dom-selector-001',
      'dom-events-002',
      'dom-create-003',
      'dom-manipulation-004',
      'dom-styles-005',
    ],
  },
  {
    id: 'apis',
    title: 'API & HTTP (4)',
    topic: 'apis',
    exercises: [
      'apis-fetch-001',
      'apis-error-002',
      'apis-post-003',
      'apis-async-fetch-004',
    ],
  },
  {
    id: 'dsa',
    title: 'Algoritma Dasar (7)',
    topic: 'dsa',
    exercises: [
      'dsa-array-001',
      'dsa-sort-002',
      'dsa-search-003',
      'dsa-object-004',
      'dsa-map-005',
      'dsa-filter-reduce-006',
      'dsa-recursion-007',
    ],
  },
];
