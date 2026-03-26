/**
 * Shared taxonomy for recipe filtering.
 * Used by search-client, region-cookbook-client, search API, and submit form.
 *
 * Structure:
 *   REGION_META  — top-level regions, each with sub-regions and countries
 *   ALL_COUNTRIES — flat list derived from REGION_META (for backward-compat)
 *   COURSES / COURSE_TAGS — meal-course taxonomy
 */

export interface CountryEntry {
  id: string
  label: string
  emoji: string
  styles: { id: string; label: string }[]
  foodTags: string[]
}

export interface SubRegion {
  id: string
  label: string
  countries: CountryEntry[]
}

export interface RegionEntry {
  label: string
  emoji: string
  description: string
  subRegions: SubRegion[]
  /** Flat list — union of all sub-region countries. Derived below. */
  countries: CountryEntry[]
}

/* ── helper — builds a RegionEntry and derives the flat countries list ── */
function region(
  label: string,
  emoji: string,
  description: string,
  subRegions: SubRegion[],
): RegionEntry {
  return {
    label,
    emoji,
    description,
    subRegions,
    countries: subRegions.flatMap(sr => sr.countries),
  }
}

function c(id: string, label: string, emoji: string, foodTags: string[] = [], styles: { id: string; label: string }[] = []): CountryEntry {
  return { id, label, emoji, styles, foodTags }
}

/* ─────────────────────────────────────────────────────────────────────────
   REGION_META
   ───────────────────────────────────────────────────────────────────────── */
export const REGION_META: Record<string, RegionEntry> = {

  /* ── EAST ASIA ──────────────────────────────────────────────────────── */
  'east-asia': region('Asia de Est', '🍜', 'China, Japonia, Coreea și tradițiile lor culinare', [
    {
      id: 'east-asia-main',
      label: 'Asia de Est',
      countries: [
        c('chinese',  'Chinese',  '🇨🇳', ['chinese'], [
          { id: 'sichuan',     label: 'Sichuan (四川)'       },
          { id: 'cantonese',   label: 'Cantonese (粤菜)'     },
          { id: 'beijing',     label: 'Beijing (北京菜)'     },
          { id: 'shanghainese',label: 'Shanghainese (本帮菜)'},
          { id: 'dim-sum',     label: 'Dim Sum'              },
          { id: 'hunan',       label: 'Hunan'                },
          { id: 'shandong',    label: 'Shandong'             },
        ]),
        c('japanese', 'Japanese', '🇯🇵', ['japanese', 'sushi'], [
          { id: 'sushi',    label: 'Sushi & Sashimi' },
          { id: 'ramen',    label: 'Ramen'           },
          { id: 'tempura',  label: 'Tempura'         },
          { id: 'izakaya',  label: 'Izakaya'         },
          { id: 'kaiseki',  label: 'Kaiseki'         },
          { id: 'yakitori', label: 'Yakitori'        },
        ]),
        c('korean',   'Korean',   '🇰🇷', ['korean'], [
          { id: 'bbq-korean', label: 'Korean BBQ'         },
          { id: 'jjigae',     label: 'Jjigae (Stew)'      },
          { id: 'bibimbap',   label: 'Bibimbap'           },
          { id: 'banchan',    label: 'Banchan'            },
          { id: 'tteok',      label: 'Tteokbokki'        },
        ]),
        c('taiwanese',  'Taiwanese',  '🇹🇼', ['taiwanese']),
        c('hongkong',   'Hong Kong',  '🇭🇰', ['hongkong']),
        c('mongolian',  'Mongolian',  '🇲🇳', ['mongolian']),
      ],
    },
  ]),

  /* ── SOUTHEAST ASIA ─────────────────────────────────────────────────── */
  'southeast-asia': region('Asia de Sud-Est', '🌴', 'Thailanda, Vietnam, Indonezia și aromele tropicale', [
    {
      id: 'mainland-sea',
      label: 'Continental',
      countries: [
        c('thai',       'Thai',       '🇹🇭', ['thai', 'noodles'], [
          { id: 'central-thai',    label: 'Central Thai'   },
          { id: 'northern-thai',   label: 'Northern Thai'  },
          { id: 'street-food-thai',label: 'Street Food'    },
          { id: 'royal-thai',      label: 'Royal Thai'     },
        ]),
        c('vietnamese', 'Vietnamese', '🇻🇳', ['vietnamese'], [
          { id: 'pho',         label: 'Phở'               },
          { id: 'banh-mi',     label: 'Bánh Mì'           },
          { id: 'hue-style',   label: 'Huế Style'         },
          { id: 'southern-viet', label: 'Southern Vietnamese' },
        ]),
        c('cambodian',  'Cambodian',  '🇰🇭', ['cambodian']),
        c('lao',        'Lao',        '🇱🇦', ['lao']),
        c('burmese',    'Burmese',    '🇲🇲', ['burmese']),
      ],
    },
    {
      id: 'island-sea',
      label: 'Insular',
      countries: [
        c('indonesian', 'Indonesian', '🇮🇩', ['indonesian'], [
          { id: 'padang',   label: 'Padang (Minangkabau)' },
          { id: 'javanese', label: 'Javanese'             },
          { id: 'balinese', label: 'Balinese'             },
          { id: 'sundanese',label: 'Sundanese'            },
        ]),
        c('malaysian',  'Malaysian',  '🇲🇾', ['malaysian']),
        c('singaporean','Singaporean','🇸🇬', ['singaporean']),
        c('filipino',   'Filipino',   '🇵🇭', ['filipino']),
        c('bruneian',   'Bruneian',   '🇧🇳', ['bruneian']),
        c('timorese',   'East Timorese','🇹🇱', []),
      ],
    },
  ]),

  /* ── SOUTH ASIA ─────────────────────────────────────────────────────── */
  'south-asia': region('Asia de Sud', '🍛', 'India, Pakistan, Bangladesh și subcontinentul bogat în condimente', [
    {
      id: 'south-asia-main',
      label: 'Asia de Sud',
      countries: [
        c('indian',     'Indian',     '🇮🇳', ['indian', 'curry'], [
          { id: 'north-indian',       label: 'North Indian'    },
          { id: 'south-indian',       label: 'South Indian'    },
          { id: 'mughlai',            label: 'Mughlai'         },
          { id: 'street-food-india',  label: 'Street Food'     },
          { id: 'tandoor',            label: 'Tandoor'         },
          { id: 'goan',               label: 'Goan'            },
          { id: 'bengali',            label: 'Bengali'         },
          { id: 'rajasthani',         label: 'Rajasthani'      },
        ]),
        c('pakistani',  'Pakistani',  '🇵🇰', ['pakistani']),
        c('bangladeshi','Bangladeshi','🇧🇩', ['bangladeshi']),
        c('srilankan',  'Sri Lankan', '🇱🇰', ['srilankan']),
        c('nepali',     'Nepali',     '🇳🇵', ['nepali']),
        c('bhutanese',  'Bhutanese',  '🇧🇹', ['bhutanese']),
        c('maldivian',  'Maldivian',  '🇲🇻', []),
      ],
    },
  ]),

  /* ── CENTRAL ASIA & CAUCASUS ─────────────────────────────────────────── */
  'central-asia': region('Asia Centrală și Caucaz', '🏔️', 'Arome din Drumul Mătăsii, din Georgia până în Kazahstan', [
    {
      id: 'caucasus',
      label: 'Caucaz',
      countries: [
        c('georgian',   'Georgian',   '🇬🇪', ['georgian']),
        c('armenian',   'Armenian',   '🇦🇲', ['armenian']),
        c('azerbaijani','Azerbaijani','🇦🇿', ['azerbaijani']),
      ],
    },
    {
      id: 'central-asia-stans',
      label: 'Asia Centrală',
      countries: [
        c('uzbek',       'Uzbek',       '🇺🇿', ['uzbek']),
        c('kazakh',      'Kazakh',      '🇰🇿', ['kazakh']),
        c('kyrgyz',      'Kyrgyz',      '🇰🇬', ['kyrgyz']),
        c('tajik',       'Tajik',       '🇹🇯', ['tajik']),
        c('turkmen',     'Turkmen',     '🇹🇲', ['turkmen']),
        c('afghan',      'Afghan',      '🇦🇫', ['afghan']),
      ],
    },
  ]),

  /* ── MIDDLE EAST ─────────────────────────────────────────────────────── */
  'middle-east': region('Orientul Mijlociu', '🧆', 'Mezze levantine, orez persan și condimente arabe', [
    {
      id: 'levant',
      label: 'Levant',
      countries: [
        c('lebanese',   'Lebanese',   '🇱🇧', ['lebanese'], [
          { id: 'mezze-lb', label: 'Mezze'         },
          { id: 'grill-lb', label: 'Grills'        },
          { id: 'fattoush', label: 'Salads'        },
        ]),
        c('syrian',     'Syrian',     '🇸🇾', ['syrian']),
        c('jordanian',  'Jordanian',  '🇯🇴', ['jordanian']),
        c('palestinian','Palestinian','🇵🇸', ['palestinian']),
        c('israeli',    'Israeli',    '🇮🇱', ['israeli']),
      ],
    },
    {
      id: 'gulf',
      label: 'Golf',
      countries: [
        c('saudi',      'Saudi',      '🇸🇦', ['saudi']),
        c('emirati',    'Emirati',    '🇦🇪', ['emirati']),
        c('qatari',     'Qatari',     '🇶🇦', ['qatari']),
        c('kuwaiti',    'Kuwaiti',    '🇰🇼', ['kuwaiti']),
        c('bahraini',   'Bahraini',   '🇧🇭', ['bahraini']),
        c('omani',      'Omani',      '🇴🇲', ['omani']),
        c('yemeni',     'Yemeni',     '🇾🇪', ['yemeni']),
      ],
    },
    {
      id: 'persian',
      label: 'Persian',
      countries: [
        c('iranian',    'Iranian',    '🇮🇷', ['iranian', 'persian'], [
          { id: 'rice-persian', label: 'Persian Rice Dishes' },
          { id: 'stew-persian', label: 'Khoresh (Stews)'     },
          { id: 'kebab-persian',label: 'Kebabs'              },
        ]),
        c('iraqi',      'Iraqi',      '🇮🇶', ['iraqi']),
      ],
    },
    {
      id: 'turkey-cyprus',
      label: 'Turcia și Cipru',
      countries: [
        c('turkish',    'Turkish',    '🇹🇷', ['turkish'], [
          { id: 'kebabs',    label: 'Kebabs'        },
          { id: 'mezze-tr',  label: 'Mezze'         },
          { id: 'pide',      label: 'Pide & Lahmacun'},
          { id: 'anatolian', label: 'Anatolian'     },
        ]),
        c('cypriot',    'Cypriot',    '🇨🇾', ['cypriot']),
      ],
    },
  ]),

  /* ── WESTERN EUROPE ──────────────────────────────────────────────────── */
  'western-europe': region('Europa de Vest', '🥖', 'Franța, Italia, Spania și inima culinară a Europei', [
    {
      id: 'med-europe',
      label: 'Mediteraneean',
      countries: [
        c('italian',  'Italian',  '🇮🇹', ['italian', 'pizza', 'pasta'], [
          { id: 'bolognese',  label: 'Bolognese (Emilia-Romagna)' },
          { id: 'neapolitan', label: 'Neapolitan (Campania)'      },
          { id: 'sicilian',   label: 'Sicilian'                   },
          { id: 'roman',      label: 'Roman (Cucina Romana)'      },
          { id: 'venetian',   label: 'Venetian'                   },
          { id: 'milanese',   label: 'Milanese'                   },
          { id: 'calabrese',  label: 'Calabrese'                  },
        ]),
        c('spanish',  'Spanish',  '🇪🇸', ['spanish', 'paella'], [
          { id: 'tapas',          label: 'Tapas'              },
          { id: 'valencian',      label: 'Valencian (Paella)' },
          { id: 'basque-spanish', label: 'Basque (Pintxos)'   },
          { id: 'andalusian',     label: 'Andalusian'         },
          { id: 'catalan',        label: 'Catalan'            },
        ]),
        c('greek',    'Greek',    '🇬🇷', ['greek'], [
          { id: 'mezze',        label: 'Mezze'          },
          { id: 'island-greek', label: 'Island Greek'   },
          { id: 'mainland-gr',  label: 'Mainland Greek' },
        ]),
        c('portuguese','Portuguese','🇵🇹', ['portuguese'], [
          { id: 'petiscos', label: 'Petiscos'   },
          { id: 'bacalhau', label: 'Bacalhau'   },
          { id: 'pasteis',  label: 'Pastéis'    },
        ]),
        c('maltese',  'Maltese',  '🇲🇹', ['maltese']),
      ],
    },
    {
      id: 'western-europe-core',
      label: 'Nucleul Vestic',
      countries: [
        c('french',   'French',   '🇫🇷', ['french', 'pastry'], [
          { id: 'provencal',   label: 'Provençal'    },
          { id: 'burgundian',  label: 'Burgundian'   },
          { id: 'alsatian',    label: 'Alsatian'     },
          { id: 'basque-fr',   label: 'Basque'       },
          { id: 'bistro',      label: 'Bistro'       },
          { id: 'normand',     label: 'Normand'      },
        ]),
        c('german',   'German',   '🇩🇪', ['german'], [
          { id: 'bavarian',  label: 'Bavarian'      },
          { id: 'swabian',   label: 'Swabian'       },
          { id: 'rheinisch', label: 'Rheinisch'     },
        ]),
        c('austrian', 'Austrian', '🇦🇹', ['austrian']),
        c('swiss',    'Swiss',    '🇨🇭', ['swiss']),
        c('dutch',    'Dutch',    '🇳🇱', ['dutch']),
        c('belgian',  'Belgian',  '🇧🇪', ['belgian']),
        c('luxembourgish','Luxembourgish','🇱🇺', []),
      ],
    },
    {
      id: 'british-irish',
      label: 'Britanic și Irlandez',
      countries: [
        c('british',  'British',  '🇬🇧', ['british'], [
          { id: 'english',  label: 'English'  },
          { id: 'scottish', label: 'Scottish' },
          { id: 'welsh',    label: 'Welsh'    },
          { id: 'pub-grub', label: 'Pub Grub' },
        ]),
        c('irish',    'Irish',    '🇮🇪', ['irish']),
      ],
    },
  ]),

  /* ── NORTHERN EUROPE ─────────────────────────────────────────────────── */
  'northern-europe': region('Europa de Nord', '🐟', 'Afumătorie scandinavă, pâine baltică de secară, culegere nordică', [
    {
      id: 'nordic',
      label: 'Nordic',
      countries: [
        c('swedish',   'Swedish',   '🇸🇪', ['swedish', 'scandinavian'], [
          { id: 'smorgasbord', label: 'Smörgåsbord' },
          { id: 'new-nordic',  label: 'New Nordic'  },
        ]),
        c('norwegian', 'Norwegian', '🇳🇴', ['norwegian']),
        c('danish',    'Danish',    '🇩🇰', ['danish']),
        c('finnish',   'Finnish',   '🇫🇮', ['finnish']),
        c('icelandic', 'Icelandic', '🇮🇸', ['icelandic']),
      ],
    },
    {
      id: 'baltic',
      label: 'Baltic',
      countries: [
        c('estonian',  'Estonian',  '🇪🇪', ['estonian']),
        c('latvian',   'Latvian',   '🇱🇻', ['latvian']),
        c('lithuanian','Lithuanian','🇱🇹', ['lithuanian']),
      ],
    },
  ]),

  /* ── EASTERN EUROPE ──────────────────────────────────────────────────── */
  'eastern-europe': region('Europa de Est', '🥟', 'De la pierogii polonezi la mămăliga românească și khinkali georgienii', [
    {
      id: 'central-europe',
      label: 'Europa Centrală',
      countries: [
        c('polish',   'Polish',   '🇵🇱', ['polish'], [
          { id: 'pierogi',    label: 'Pierogi'     },
          { id: 'bigos',      label: 'Bigos'       },
          { id: 'zurek',      label: 'Żurek'       },
        ]),
        c('czech',    'Czech',    '🇨🇿', ['czech']),
        c('slovak',   'Slovak',   '🇸🇰', ['slovak']),
        c('hungarian','Hungarian','🇭🇺', ['hungarian'], [
          { id: 'goulash',   label: 'Goulash'     },
          { id: 'langos',    label: 'Lángos'      },
        ]),
        c('slovenian','Slovenian','🇸🇮', ['slovenian']),
        c('croatian', 'Croatian', '🇭🇷', ['croatian']),
      ],
    },
    {
      id: 'balkans',
      label: 'Balcani',
      countries: [
        c('serbian',    'Serbian',    '🇷🇸', ['serbian']),
        c('bosnian',    'Bosnian',    '🇧🇦', ['bosnian']),
        c('albanian',   'Albanian',   '🇦🇱', ['albanian']),
        c('macedonian', 'Macedonian', '🇲🇰', ['macedonian']),
        c('bulgarian',  'Bulgarian',  '🇧🇬', ['bulgarian']),
        c('romanian',   'Romanian',   '🇷🇴', ['romanian']),
        c('moldovan',   'Moldovan',   '🇲🇩', ['moldovan']),
        c('montenegrin','Montenegrin','🇲🇪', ['montenegrin']),
        c('kosovar',    'Kosovar',    '🇽🇰', ['kosovar']),
      ],
    },
    {
      id: 'eastern-europe-core',
      label: 'Est',
      countries: [
        c('ukrainian', 'Ukrainian', '🇺🇦', ['ukrainian'], [
          { id: 'borscht',  label: 'Borscht'       },
          { id: 'varenyky', label: 'Varenyky'      },
          { id: 'salo',     label: 'Salo & Meats'  },
        ]),
        c('russian',   'Russian',   '🇷🇺', ['russian'], [
          { id: 'pelmeni',   label: 'Pelmeni'       },
          { id: 'blini',     label: 'Blini'         },
          { id: 'solyanka',  label: 'Solyanka'      },
          { id: 'shashlik',  label: 'Shashlik'      },
        ]),
        c('belarusian','Belarusian','🇧🇾', ['belarusian']),
      ],
    },
  ]),

  /* ── NORTH AFRICA ─────────────────────────────────────────────────────── */
  'north-africa': region('Africa de Nord', '🏺', 'Tagine marocan, ful egiptean și harissa tunisiană', [
    {
      id: 'north-africa-main',
      label: 'Africa de Nord',
      countries: [
        c('moroccan',  'Moroccan',  '🇲🇦', ['moroccan'], [
          { id: 'tagine',   label: 'Tagine'    },
          { id: 'couscous', label: 'Couscous'  },
          { id: 'bastilla', label: 'Bastilla'  },
          { id: 'harira',   label: 'Harira'    },
        ]),
        c('algerian',  'Algerian',  '🇩🇿', ['algerian']),
        c('tunisian',  'Tunisian',  '🇹🇳', ['tunisian']),
        c('libyan',    'Libyan',    '🇱🇾', ['libyan']),
        c('egyptian',  'Egyptian',  '🇪🇬', ['egyptian'], [
          { id: 'ful',       label: 'Ful & Falafel' },
          { id: 'koshary',   label: 'Koshary'       },
          { id: 'mahshi',    label: 'Mahshi'        },
        ]),
        c('sudanese',  'Sudanese',  '🇸🇩', ['sudanese']),
        c('mauritanian','Mauritanian','🇲🇷', ['mauritanian']),
      ],
    },
  ]),

  /* ── WEST AFRICA ──────────────────────────────────────────────────────── */
  'west-africa': region('Africa de Vest', '🫙', 'Tocane nigeriene, jollof ghanez și thiéboudienne senegalez', [
    {
      id: 'west-africa-main',
      label: 'Africa de Vest',
      countries: [
        c('nigerian',   'Nigerian',   '🇳🇬', ['nigerian'], [
          { id: 'jollof-ng',   label: 'Jollof Rice'  },
          { id: 'egusi',       label: 'Egusi Soup'   },
          { id: 'suya',        label: 'Suya'         },
          { id: 'peppersoup',  label: 'Pepper Soup'  },
        ]),
        c('ghanaian',   'Ghanaian',   '🇬🇭', ['ghanaian']),
        c('senegalese', 'Senegalese', '🇸🇳', ['senegalese']),
        c('ivorian',    'Ivorian',    '🇨🇮', ['ivorian']),
        c('malian',     'Malian',     '🇲🇱', ['malian']),
        c('guinean',    'Guinean',    '🇬🇳', ['guinean']),
        c('togolese',   'Togolese',   '🇹🇬', ['togolese']),
        c('beninese',   'Beninese',   '🇧🇯', ['beninese']),
        c('cameroonian','Cameroonian','🇨🇲', ['cameroonian']),
        c('liberian',   'Liberian',   '🇱🇷', ['liberian']),
        c('sierraleonean','Sierra Leonean','🇸🇱', []),
        c('gambian',    'Gambian',    '🇬🇲', ['gambian']),
        c('burkinabe',  'Burkinabé',  '🇧🇫', []),
        c('nigerien',   'Nigerien',   '🇳🇪', []),
      ],
    },
  ]),

  /* ── EAST AFRICA ──────────────────────────────────────────────────────── */
  'east-africa': region('Africa de Est', '☕', 'Injera etiopiană, nyama choma kenyană și insulele cu condimente din Zanzibar', [
    {
      id: 'horn-of-africa',
      label: 'Cornul Africii',
      countries: [
        c('ethiopian',  'Ethiopian',  '🇪🇹', ['ethiopian'], [
          { id: 'injera',    label: 'Injera & Stews' },
          { id: 'tibs',      label: 'Tibs'           },
          { id: 'kitfo',     label: 'Kitfo'          },
        ]),
        c('somali',     'Somali',     '🇸🇴', ['somali']),
        c('eritrean',   'Eritrean',   '🇪🇷', ['eritrean']),
        c('djiboutian', 'Djiboutian', '🇩🇯', []),
      ],
    },
    {
      id: 'great-lakes-africa',
      label: 'Marile Lacuri',
      countries: [
        c('kenyan',    'Kenyan',    '🇰🇪', ['kenyan']),
        c('tanzanian', 'Tanzanian', '🇹🇿', ['tanzanian']),
        c('ugandan',   'Ugandan',   '🇺🇬', ['ugandan']),
        c('rwandan',   'Rwandan',   '🇷🇼', ['rwandan']),
        c('burundian', 'Burundian', '🇧🇮', []),
        c('congolese', 'Congolese', '🇨🇩', ['congolese']),
      ],
    },
  ]),

  /* ── SOUTHERN AFRICA ──────────────────────────────────────────────────── */
  'southern-africa': region('Africa de Sud', '🔥', 'Braai sud-african, sadza din Zimbabwe și romazava din Madagascar', [
    {
      id: 'southern-africa-main',
      label: 'Africa de Sud',
      countries: [
        c('south-african','South African','🇿🇦', ['south-african'], [
          { id: 'braai',      label: 'Braai (BBQ)'  },
          { id: 'cape-malay', label: 'Cape Malay'   },
          { id: 'boerekos',   label: 'Boerekos'     },
        ]),
        c('zimbabwean',  'Zimbabwean',  '🇿🇼', ['zimbabwean']),
        c('zambian',     'Zambian',     '🇿🇲', ['zambian']),
        c('malawian',    'Malawian',    '🇲🇼', ['malawian']),
        c('mozambican',  'Mozambican',  '🇲🇿', ['mozambican']),
        c('botswanan',   'Botswanan',   '🇧🇼', []),
        c('namibian',    'Namibian',    '🇳🇦', []),
        c('malagasy',    'Malagasy',    '🇲🇬', ['malagasy']),
      ],
    },
  ]),

  /* ── NORTH AMERICA ────────────────────────────────────────────────────── */
  'north-america': region('America de Nord', '🍔', 'BBQ american, poutine canadian și street food mexican', [
    {
      id: 'usa',
      label: 'Statele Unite',
      countries: [
        c('american-south',    'Southern US',       '🇺🇸', ['southern', 'bbq'], [
          { id: 'bbq-us',    label: 'BBQ'            },
          { id: 'soul-food', label: 'Soul Food'       },
          { id: 'cajun',     label: 'Cajun & Creole'  },
          { id: 'lowcountry',label: 'Lowcountry'      },
        ]),
        c('american-northeast','Northeastern US',   '🗽', ['american'], [
          { id: 'ny-deli',       label: 'NYC Deli'       },
          { id: 'ny-pizza',      label: 'NYC Pizza'      },
          { id: 'new-england',   label: 'New England'    },
        ]),
        c('tex-mex',           'Tex-Mex',           '🌵', ['tex-mex']),
        c('american-midwest',  'Midwestern US',     '🌽', ['american']),
        c('american-west',     'Western US',        '🌲', ['american'], [
          { id: 'farm-to-table', label: 'Farm-to-Table' },
          { id: 'pnw-seafood',   label: 'PNW Seafood'   },
          { id: 'californian',   label: 'Californian'   },
        ]),
      ],
    },
    {
      id: 'canada-mexico',
      label: 'Canada și Mexic',
      countries: [
        c('canadian', 'Canadian', '🇨🇦', ['canadian'], [
          { id: 'poutine',    label: 'Québécois'       },
          { id: 'indigenous', label: 'Indigenous'      },
        ]),
        c('mexican',  'Mexican',  '🇲🇽', ['mexican', 'tacos'], [
          { id: 'oaxacan',  label: 'Oaxacan'      },
          { id: 'yucatan',  label: 'Yucatán'      },
          { id: 'tacos',    label: 'Street Tacos' },
          { id: 'mole',     label: 'Mole'         },
          { id: 'veracruz', label: 'Veracruz'     },
        ]),
      ],
    },
    {
      id: 'central-america',
      label: 'America Centrală și Caraibe',
      countries: [
        c('guatemalan',  'Guatemalan',  '🇬🇹', ['guatemalan']),
        c('salvadoran',  'Salvadoran',  '🇸🇻', ['salvadoran']),
        c('honduran',    'Honduran',    '🇭🇳', ['honduran']),
        c('nicaraguan',  'Nicaraguan',  '🇳🇮', ['nicaraguan']),
        c('costarican',  'Costa Rican', '🇨🇷', ['costarican']),
        c('panamanian',  'Panamanian',  '🇵🇦', ['panamanian']),
        c('cuban',       'Cuban',       '🇨🇺', ['cuban']),
        c('jamaican',    'Jamaican',    '🇯🇲', ['jamaican'], [
          { id: 'jerk', label: 'Jerk' },
        ]),
        c('trinidadian', 'Trinidadian', '🇹🇹', ['trinidadian']),
        c('haitian',     'Haitian',     '🇭🇹', ['haitian']),
        c('dominican',   'Dominican',   '🇩🇴', ['dominican']),
        c('puerto-rican','Puerto Rican','🇵🇷', ['puerto-rican']),
        c('barbadian',   'Barbadian',   '🇧🇧', []),
      ],
    },
  ]),

  /* ── CENTRAL AMERICA & CARIBBEAN (alias for cookbooks page) ──────────── */
  'central-america-caribbean': region('America Centrală și Caraibe', '🌮', 'Cuba, Jamaica, Panama, Guatemala și insulele Caraibilor', [
    {
      id: 'central-america',
      label: 'America Centrală și Caraibe',
      countries: [
        c('guatemalan',  'Guatemalan',  '🇬🇹', ['guatemalan']),
        c('salvadoran',  'Salvadoran',  '🇸🇻', ['salvadoran']),
        c('honduran',    'Honduran',    '🇭🇳', ['honduran']),
        c('nicaraguan',  'Nicaraguan',  '🇳🇮', ['nicaraguan']),
        c('costarican',  'Costa Rican', '🇨🇷', ['costarican']),
        c('panamanian',  'Panamanian',  '🇵🇦', ['panamanian']),
        c('cuban',       'Cuban',       '🇨🇺', ['cuban']),
        c('jamaican',    'Jamaican',    '🇯🇲', ['jamaican'], [
          { id: 'jerk', label: 'Jerk' },
        ]),
        c('trinidadian', 'Trinidadian', '🇹🇹', ['trinidadian']),
        c('haitian',     'Haitian',     '🇭🇹', ['haitian']),
        c('dominican',   'Dominican',   '🇩🇴', ['dominican']),
        c('puerto-rican','Puerto Rican','🇵🇷', ['puerto-rican']),
        c('barbadian',   'Barbadian',   '🇧🇧', []),
      ],
    },
  ]),

  /* ── SOUTH AMERICA ────────────────────────────────────────────────────── */
  'south-america': region('America de Sud', '🌮', 'Ceviche peruan, churrasco brazilian și asado argentinian', [
    {
      id: 'andean',
      label: 'Andin',
      countries: [
        c('peruvian',   'Peruvian',   '🇵🇪', ['peruvian', 'ceviche'], [
          { id: 'ceviche',  label: 'Ceviche'                    },
          { id: 'nikkei',   label: 'Nikkei (Japanese-Peruvian)' },
          { id: 'chifa',    label: 'Chifa (Chinese-Peruvian)'   },
          { id: 'andean',   label: 'Andean'                     },
        ]),
        c('bolivian',   'Bolivian',   '🇧🇴', ['bolivian']),
        c('ecuadorian', 'Ecuadorian', '🇪🇨', ['ecuadorian']),
        c('colombian',  'Colombian',  '🇨🇴', ['colombian']),
        c('venezuelan', 'Venezuelan', '🇻🇪', ['venezuelan']),
      ],
    },
    {
      id: 'southern-cone',
      label: 'Conul Sudic',
      countries: [
        c('argentinian','Argentinian','🇦🇷', ['argentinian'], [
          { id: 'asado',      label: 'Asado'      },
          { id: 'empanadas',  label: 'Empanadas'  },
          { id: 'chimichurri',label: 'Chimichurri'},
        ]),
        c('brazilian',  'Brazilian',  '🇧🇷', ['brazilian'], [
          { id: 'churrasco', label: 'Churrasco (BBQ)' },
          { id: 'bahian',    label: 'Bahian'           },
          { id: 'feijoada',  label: 'Feijoada'         },
          { id: 'mineiro',   label: 'Mineiro'          },
        ]),
        c('chilean',    'Chilean',    '🇨🇱', ['chilean']),
        c('uruguayan',  'Uruguayan',  '🇺🇾', ['uruguayan']),
        c('paraguayan', 'Paraguayan', '🇵🇾', ['paraguayan']),
        c('guyanese',   'Guyanese',   '🇬🇾', ['guyanese']),
        c('surinamese', 'Surinamese', '🇸🇷', ['surinamese']),
      ],
    },
  ]),

  /* ── OCEANIA ──────────────────────────────────────────────────────────── */
  oceania: region('Oceania', '🦘', 'BBQ australian, hāngī maori și festinuri din insulele Pacificului', [
    {
      id: 'australasia',
      label: 'Australasia',
      countries: [
        c('australian',   'Australian',   '🇦🇺', ['australian'], [
          { id: 'aussie-bbq',   label: 'BBQ & Grill'    },
          { id: 'bush-tucker',  label: 'Bush Tucker'    },
          { id: 'modern-oz',    label: 'Modern Australian'},
        ]),
        c('new-zealand',  'New Zealand',  '🇳🇿', ['new-zealand'], [
          { id: 'maori',      label: 'Māori (Hāngī)'   },
          { id: 'kiwi-mod',   label: 'Modern NZ'       },
        ]),
      ],
    },
    {
      id: 'pacific-islands',
      label: 'Insulele Pacificului',
      countries: [
        c('fijian',       'Fijian',       '🇫🇯', ['fijian']),
        c('samoan',       'Samoan',       '🇼🇸', ['samoan']),
        c('tongan',       'Tongan',       '🇹🇴', ['tongan']),
        c('hawaiian',     'Hawaiian',     '🌺',   ['hawaiian']),
        c('papua-ng',     'Papua New Guinean', '🇵🇬', []),
        c('vanuatuan',    'Vanuatuan',    '🇻🇺', []),
      ],
    },
  ]),

  /* ── FUSION & GLOBAL ──────────────────────────────────────────────────── */
  international: region('Internațional și Fuziune', '🌍', 'Gătit intercultural și rețete fără frontiere', [
    {
      id: 'fusion',
      label: 'Fuziune',
      countries: [
        c('asian-fusion',     'Asian Fusion',          '✨', ['fusion']),
        c('med-fusion',       'Mediterranean Fusion',   '🤝', ['fusion']),
        c('modern-global',    'Modern Global',          '🌐', ['fusion']),
        c('afro-fusion',      'Afro-Fusion',            '🌍', ['fusion']),
        c('latin-fusion',     'Latin Fusion',           '🌶️', ['fusion']),
      ],
    },
    {
      id: 'plant-based',
      label: 'Pe bază de plante',
      countries: [
        c('vegan-global',     'Vegan / Plant-Based',    '🌱', ['healthy', 'vegan']),
        c('raw-food',         'Raw Food',               '🥗', ['healthy']),
        c('wholefood',        'Whole Food',             '🌾', ['healthy']),
      ],
    },
  ]),
}

/* ─────────────────────────────────────────────────────────────────────────
   Derived helpers — backward-compatible
   ───────────────────────────────────────────────────────────────────────── */

/** Flat list of all countries across all regions */
export const ALL_COUNTRIES = Object.entries(REGION_META).flatMap(([regionId, region]) =>
  region.countries.map((c) => ({
    ...c,
    regionId,
    regionLabel: region.label,
    regionEmoji: region.emoji,
  }))
)

/* ─────────────────────────────────────────────────────────────────────────
   COURSES
   ───────────────────────────────────────────────────────────────────────── */
export const COURSES = [
  { id: 'all',       label: 'Toate categoriile', emoji: '🍽️' },
  { id: 'breakfast', label: 'Mic dejun',   emoji: '🥐'  },
  { id: 'brunch',    label: 'Brunch',      emoji: '🥞'  },
  { id: 'lunch',     label: 'Prânz',       emoji: '🥙'  },
  { id: 'dinner',    label: 'Cină',      emoji: '🍽️' },
  { id: 'appetiser', label: 'Aperitiv',   emoji: '🥗'  },
  { id: 'soup',      label: 'Supă',        emoji: '🍲'  },
  { id: 'main',      label: 'Fel principal',        emoji: '🍛'  },
  { id: 'side',      label: 'Garnitură',   emoji: '🥦'  },
  { id: 'dessert',   label: 'Desert',     emoji: '🍰'  },
  { id: 'snack',     label: 'Gustare',       emoji: '🧆'  },
  { id: 'drink',     label: 'Băutură',       emoji: '🧃'  },
]

export const COURSE_TAGS: Record<string, string[]> = {
  breakfast: ['breakfast', 'eggs', 'pastry', 'pancakes'],
  brunch:    ['brunch', 'breakfast', 'eggs', 'pastry'],
  lunch:     ['lunch', 'salad', 'sandwich', 'soup', 'bowl'],
  dinner:    ['dinner', 'curry', 'pasta', 'rice', 'paella', 'tacos', 'noodles', 'casserole', 'stew', 'lamb', 'chicken', 'seafood'],
  appetiser: ['appetiser', 'starter', 'mezze', 'tapas', 'dim-sum'],
  soup:      ['soup', 'stew', 'broth', 'pho', 'ramen'],
  main:      ['curry', 'pasta', 'rice', 'paella', 'tacos', 'noodles', 'casserole'],
  side:      ['side', 'salad', 'vegetables', 'banchan'],
  dessert:   ['dessert', 'pastry', 'cheesecake', 'cake', 'bread'],
  snack:     ['snack', 'street-food'],
  drink:     ['drink', 'smoothie', 'juice'],
}
