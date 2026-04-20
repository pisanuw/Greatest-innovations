// js/data.js
// Canonical list of the 40 greatest innovations.
// `id` is the correct chronological rank (1 = oldest).
// Year is stored for the results screen only — NOT shown during gameplay.

export const CARDS = [
  { id:  1, name: 'Fire',                    year: '400,000 BCE' },
  { id:  2, name: 'Language',                year: '100,000 BCE' },
  { id:  3, name: 'Trade & Specialization',  year: '17,000 BCE'  },
  { id:  4, name: 'Farming',                 year: '15,000 BCE'  },
  { id:  5, name: 'Ship',                    year: '4,000 BCE'   },
  { id:  6, name: 'Wheel',                   year: '3,400 BCE'   },
  { id:  7, name: 'Money',                   year: '3,000 BCE'   },
  { id:  8, name: 'Iron',                    year: '3,000 BCE'   },
  { id:  9, name: 'Written Language',        year: '2,900 BCE'   },
  { id: 10, name: 'Legal System',            year: '1,780 BCE'   },
  { id: 11, name: 'Alphabet',                year: '1,050 BCE'   },
  { id: 12, name: 'Steel',                   year: '650 BCE'     },
  { id: 13, name: 'Water Power',             year: '200 BCE'     },
  { id: 14, name: 'Paper',                   year: '105 CE'      },
  { id: 15, name: 'Movable Type',            year: '1040 CE'     },
  { id: 16, name: 'Microscope',              year: '1592'        },
  { id: 17, name: 'Electricity',             year: '1600'        },
  { id: 18, name: 'Telescope',               year: '1608'        },
  { id: 19, name: 'Engine',                  year: '1712'        },
  { id: 20, name: 'Light Bulb',              year: '1800'        },
  { id: 21, name: 'Telegraph',               year: '1809'        },
  { id: 22, name: 'Electromagnet',           year: '1825'        },
  { id: 23, name: 'Petroleum',               year: '1859'        },
  { id: 24, name: 'Telephone',               year: '1860'        },
  { id: 25, name: 'Vacuum Tube',             year: '1883'        },
  { id: 26, name: 'Semiconductors',          year: '1896'        },
  { id: 27, name: 'Penicillin',              year: '1896'        },
  { id: 28, name: 'Radio',                   year: '1897'        },
  { id: 29, name: 'Electron',                year: '1897'        },
  { id: 30, name: 'Quantum Physics',         year: '1900'        },
  { id: 31, name: 'Airplane',                year: '1903'        },
  { id: 32, name: 'Television',              year: '1926'        },
  { id: 33, name: 'Transistor',              year: '1947'        },
  { id: 34, name: 'DNA',                     year: '1953'        },
  { id: 35, name: 'Integrated Circuit',      year: '1959'        },
  { id: 36, name: 'Internet',                year: '1969'        },
  { id: 37, name: 'Microprocessor',          year: '1971'        },
  { id: 38, name: 'Mobile Phone',            year: '1973'        },
  { id: 39, name: 'Smartphone',              year: '2007'        },
  { id: 40, name: 'Quantum Computer',        year: '2011'        },
];

/** Map from id → card for O(1) lookup */
export const CARD_MAP = new Map(CARDS.map(c => [c.id, c]));
