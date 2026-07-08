import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, map, of } from 'rxjs';

import {
  Campaign,
  CampaignEncounter,
  CampaignItem,
  CampaignLocation,
  CampaignNpc,
  CampaignOption,
  CampaignPlayerCharacter,
  CampaignScene,
  PlayerOption,
} from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { GENERIC_NPCS } from '../../../../core/data/generic-npcs';
import {
  RuleEquipment,
  RuleFeat,
  RuleGenericNpc,
  RuleSkill,
  RuleSpell,
  RulesCompendium,
} from '../../../../core/models/rules';
import { RulesDataService } from '../../../../core/services/rules-data';

type CompendiumSection =
  | 'search'
  | 'npcs'
  | 'tokens'
  | 'players'
  | 'items'
  | 'locations'
  | 'scenes'
  | 'encounters'
  | 'spells'
  | 'feats'
  | 'skills'
  | 'equipment'
  | 'generic-npcs'
  | 'timeline'
  | 'antagonists';

interface CompendiumCard {
  key: string;
  name: string;
  kicker: string;
  summary: string;
  description?: string;
  tags: string[];
  meta: string[];
  bullets: string[];
  mapUrl?: string;
  vttUrl?: string;
  tokenUrl?: string;
  gridTokenUrl?: string;
  tokenPreview?: boolean;
  stats?: { label: string; value: string }[];
  detailSections?: CompendiumDetailSection[];
  portrait?: CompendiumPortrait;
}

interface CompendiumDetailSection {
  title: string;
  entries: string[];
  compact?: boolean;
}

interface CompendiumPortrait {
  src: string;
  position: string;
  size: string;
}

const NPC_PORTRAITS: Record<string, CompendiumPortrait> = {
  'lord-edric-hawkwinter': atlasPortrait('atlas-01-hawkwinter.png', 'left top'),
  'hermana-elen': atlasPortrait('atlas-01-hawkwinter.png', 'right top'),
  'sir-cedric-stone': atlasPortrait('atlas-01-hawkwinter.png', 'left bottom'),
  'owen-harrow': atlasPortrait('atlas-01-hawkwinter.png', 'right bottom'),
  'marcus-flint': atlasPortrait('atlas-02-guardia.png', 'left top'),
  'hugo-tanner': atlasPortrait('atlas-02-guardia.png', 'right top'),
  'edwin-cole': atlasPortrait('atlas-02-guardia.png', 'left bottom'),
  'roland-ashford': atlasPortrait('atlas-02-guardia.png', 'right bottom'),
  'thomas-weaver': atlasPortrait('atlas-03-servicio.png', 'left top'),
  'madre-marta': atlasPortrait('atlas-03-servicio.png', 'right top'),
  'peter-mozocuadras': atlasPortrait('atlas-03-servicio.png', 'left bottom'),
  'agatha-ama-llaves': atlasPortrait('atlas-03-servicio.png', 'right bottom'),
  'elsie-criada': atlasPortrait('atlas-04-templo.png', 'left top'),
  'bram-jardinero': atlasPortrait('atlas-04-templo.png', 'right top'),
  'priora-mara-veldan': atlasPortrait('atlas-04-templo.png', 'left bottom'),
  'hermano-alaric': atlasPortrait('atlas-04-templo.png', 'right bottom'),
  'doran-mieloscura': atlasPortrait('atlas-05-posada.png', 'left top'),
  'rusk-bandido': atlasPortrait('atlas-05-posada.png', 'right top'),
  'niles-bandido': atlasPortrait('atlas-05-posada.png', 'left bottom'),
  'bren-bandido': atlasPortrait('atlas-05-posada.png', 'right bottom'),
  'oren-bandido': atlasPortrait('atlas-06-mano-hierro.png', 'left top'),
  'garrick-mano-de-hierro': atlasPortrait('atlas-06-mano-hierro.png', 'right top'),
  'kelm-segundo': atlasPortrait('atlas-06-mano-hierro.png', 'left bottom'),
  'mira-arquera': atlasPortrait('atlas-06-mano-hierro.png', 'right bottom'),
  'tob-vigia': atlasPortrait('atlas-07-amenaza.png', 'left top'),
  'harl-veterano': atlasPortrait('atlas-07-amenaza.png', 'right top'),
  'hombre-encapuchado': atlasPortrait('atlas-07-amenaza.png', 'left bottom'),
  'guerrero-extraño': atlasPortrait('atlas-07-amenaza.png', 'right bottom'),
  'varek-herrero': atlasPortrait('atlas-08-campamento.png', 'left top'),
  'silas-rastreador': atlasPortrait('atlas-08-campamento.png', 'right top'),
  'dreg-forzudo': atlasPortrait('atlas-08-campamento.png', 'left bottom'),
  'finn-tramposo': atlasPortrait('atlas-08-campamento.png', 'right bottom'),
  'jorek-leñador': atlasPortrait('atlas-09-testigos.png', 'left top'),
  'lena-exploradora': atlasPortrait('atlas-09-testigos.png', 'right top'),
  'oswin-reed': atlasPortrait('atlas-09-testigos.png', 'left bottom'),
  'hermano-tomas': atlasPortrait('atlas-09-testigos.png', 'right bottom'),
  'sargento-aldren-voss': atlasPortrait('atlas-10-escolta.png', 'left top'),
  'guarda-eamon': atlasPortrait('atlas-10-escolta.png', 'right top'),
  'guarda-borik': atlasPortrait('atlas-10-escolta.png', 'left bottom'),
  'guarda-lyra': atlasPortrait('atlas-10-escolta.png', 'right bottom'),
  'falso-clerigo': {
    src: 'assets/npcs/falso-clerigo.png',
    position: 'center top',
    size: 'cover',
  },
};

function atlasPortrait(file: string, position: string): CompendiumPortrait {
  return {
    src: `assets/npcs/${file}`,
    position,
    size: '200% 200%',
  };
}

interface CompendiumViewModel {
  eyebrow: string;
  title: string;
  description: string;
  entries: CompendiumCard[];
}

@Component({
  selector: 'app-compendium',
  imports: [AsyncPipe],
  templateUrl: './compendium.html',
  styleUrl: './compendium.scss',
})
export class Compendium {
  protected readonly allTagsLabel = 'Todas';
  protected readonly query = signal('');
  protected readonly activeTags = signal<string[]>([]);

  private readonly campaignData = inject(CampaignDataService);
  private readonly rulesData = inject(RulesDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly campaignId =
    this.route.snapshot.paramMap.get('campaignId') ?? '';
  private readonly section = this.route.snapshot.data[
    'section'
  ] as CompendiumSection;
  private readonly campaign$ = [
    'spells',
    'feats',
    'skills',
    'equipment',
    'generic-npcs',
  ].includes(this.section)
    ? of(undefined)
    : this.campaignData.getCampaign();

  protected readonly vm$ = combineLatest([
    this.campaign$,
    this.rulesData.getRules(),
    this.route.data,
    this.route.queryParamMap,
  ]).pipe(
    map(([campaign, rules, data, queryParams]) => {
      const query = queryParams.get('q') ?? '';
      const tags = Array.from(
        new Set(
          queryParams
            .getAll('tag')
            .flatMap((tag) => tag.split(','))
            .map((tag) => tag.trim())
            .filter((tag) => tag && tag !== this.allTagsLabel)
        )
      );

      if (this.query() !== query) {
        this.query.set(query);
      }

      if (this.activeTags().join('\u0000') !== tags.join('\u0000')) {
        this.activeTags.set(tags);
      }

      return this.toViewModel(
        campaign,
        rules,
        data['section'] as CompendiumSection
      );
    })
  );

  protected updateQuery(value: string): void {
    this.query.set(value);
  }

  protected setTag(tag: string): void {
    if (tag === this.allTagsLabel) {
      this.activeTags.set([]);
      return;
    }

    this.activeTags.update((activeTags) =>
      activeTags.includes(tag)
        ? activeTags.filter((activeTag) => activeTag !== tag)
        : [...activeTags, tag]
    );
  }

  protected clearFilters(): void {
    this.query.set('');
    this.activeTags.set([]);
  }

  protected tagOptions(entries: CompendiumCard[]): string[] {
    const tags = entries.flatMap((entry) => entry.tags);
    return [this.allTagsLabel, ...Array.from(new Set(tags)).sort()];
  }

  protected filteredEntries(entries: CompendiumCard[]): CompendiumCard[] {
    const query = this.normalize(this.query());
    const availableTags = new Set(entries.flatMap((entry) => entry.tags));
    const activeTags = this.activeTags().filter((tag) =>
      availableTags.has(tag)
    );

    return entries.filter((entry) => {
      const matchesTags = activeTags.every((tag) =>
        entry.tags.includes(tag)
      );
      const matchesQuery =
        !query ||
        this.normalize(
          [
            entry.name,
            entry.kicker,
            entry.summary,
            entry.description ?? '',
            ...entry.tags,
            ...entry.meta,
            ...entry.bullets,
            ...(entry.detailSections ?? []).flatMap((section) => [
              section.title,
              ...section.entries,
            ]),
          ].join(' ')
        ).includes(query);

      return matchesTags && matchesQuery;
    });
  }

  protected isTagSelected(tag: string, entries: CompendiumCard[]): boolean {
    const availableTags = new Set(entries.flatMap((entry) => entry.tags));
    const activeTags = this.activeTags().filter((activeTag) =>
      availableTags.has(activeTag)
    );

    return tag === this.allTagsLabel
      ? activeTags.length === 0
      : activeTags.includes(tag);
  }

  private toViewModel(
    campaign: Campaign | undefined,
    rules: RulesCompendium,
    section: CompendiumSection
  ): CompendiumViewModel {
    switch (section) {
      case 'spells':
        return {
          eyebrow: 'Reglas 2024',
          title: 'Hechizos',
          description:
            'Índice de conjuros con nivel, escuela, clases, lanzamiento y descripción completa.',
          entries: rules.spells.map((spell) => this.spellCard(spell)),
        };
      case 'feats':
        return {
          eyebrow: 'Reglas 2024',
          title: 'Dotes',
          description:
            'Dotes de origen, generales, estilos de combate y dones épicos con todos sus beneficios.',
          entries: rules.feats.map((feat) => this.featCard(feat)),
        };
      case 'skills':
        return {
          eyebrow: 'Reglas 2024',
          title: 'Habilidades',
          description:
            'Las habilidades del juego, su característica asociada y sus usos habituales.',
          entries: rules.skills.map((skill) => this.skillCard(skill)),
        };
      case 'equipment':
        return {
          eyebrow: 'Reglas 2024',
          title: 'Equipo',
          description:
            'Armas, armaduras, herramientas y equipo de aventura con propiedades, precio y peso.',
          entries: rules.equipment.map((item) => this.equipmentCard(item)),
        };
      case 'generic-npcs':
        return {
          eyebrow: 'Reglas 2024',
          title: 'Fichas genéricas',
          description:
            'Perfiles originales compatibles con D&D 2024 para improvisar aliados, habitantes, adversarios y encuentros en cualquier campaña.',
          entries: GENERIC_NPCS.map((npc) => this.genericNpcCard(npc)),
        };
    }

    if (!campaign) {
      return {
        eyebrow: 'Campaña',
        title: 'Sin campaña activa',
        description: 'Selecciona una campaña desde el Dashboard.',
        entries: [],
      };
    }

    switch (section) {
      case 'search':
        return {
          eyebrow: 'Búsqueda global',
          title: 'Buscar',
          description:
            'Consulta transversal de personajes, PJs sugeridos, escenas, documentos, lugares y amenazas.',
          entries: this.allCards(campaign, rules),
        };
      case 'npcs':
        return {
          eyebrow: 'Dossier de PNJ',
          title: 'Fichas de PNJ',
          description:
            'Aliados, ausentes y figuras que empujan el misterio inicial.',
          entries: campaign.npcs.map((npc) => this.npcCard(npc)),
        };
      case 'tokens':
        return {
          eyebrow: 'Mesa de juego',
          title: 'Tokens',
          description:
            'Tokens circulares de una casilla para los PNJ y personajes jugables de la campaña.',
          entries: [
            ...campaign.npcs.map((npc) => this.npcTokenCard(npc)),
            ...campaign.playerCharacters.map((player) =>
              this.namedPlayerTokenCard(player)
            ),
            ...campaign.playerOptions
              .filter((player) => player.showToken !== false)
              .map((player) => this.playerTokenCard(player)),
          ],
        };
      case 'players':
        return {
          eyebrow: 'Mesa de personajes',
          title: 'Fichas de PJ',
          description:
            'Quince personajes de nivel 5 listos para jugar, con gancho directo para entrar en la aventura.',
          entries: campaign.playerOptions.map((player) =>
            this.playerCard(player)
          ),
        };
      case 'items':
        return {
          eyebrow: 'Archivo de objetos',
          title: 'Documentos y reliquias',
          description:
            'Objetos de trama, cartas, sellos y pruebas que los héroes pueden investigar.',
          entries: campaign.items.map((item) => this.itemCard(item)),
        };
      case 'locations':
        return {
          eyebrow: 'Atlas de campaña',
          title: 'Lugares',
          description:
            'Localizaciones listas para dirigir o ampliar durante la partida.',
          entries: campaign.locations.map((location) =>
            this.locationCard(location)
          ),
        };
      case 'timeline':
        return {
          eyebrow: 'Línea temporal',
          title: 'Timeline',
          description:
            'Orden práctico de escenas para mantener ritmo, pistas y revelaciones bajo control.',
          entries: this.sortedScenes(campaign).map((scene) =>
            this.sceneCard(scene)
          ),
        };
      case 'encounters':
        return {
          eyebrow: 'Mesa de combate',
          title: 'Encuentros',
          description:
            'Combates listos para dirigir, con ajustes por tamaño de grupo, terreno y desenlaces.',
          entries: campaign.encounters.map((encounter) =>
            this.encounterCard(encounter)
          ),
        };
      case 'antagonists':
        return {
          eyebrow: 'Mesa de amenaza',
          title: 'Antagonistas',
          description:
            'Opciones de oposición para ajustar el tono: investigación simple, culto, infiltración o pacto infernal.',
          entries: campaign.antagonistOptions.map((option) =>
            this.optionCard(option)
          ),
        };
      case 'scenes':
      default:
        return {
          eyebrow: 'Mesa de dirección',
          title: 'Escenas',
          description:
            'Bloques jugables con objetivo, tiradas utiles y pistas para reconstruir el misterio.',
          entries: this.sortedScenes(campaign).map((scene) =>
            this.sceneCard(scene)
          ),
        };
    }
  }

  private allCards(
    campaign: Campaign,
    rules: RulesCompendium
  ): CompendiumCard[] {
    return [
      ...campaign.npcs.map((npc) => this.npcCard(npc)),
      ...campaign.playerCharacters.map((player) =>
        this.namedPlayerTokenCard(player)
      ),
      ...campaign.playerOptions.map((player) => this.playerCard(player)),
      ...campaign.items.map((item) => this.itemCard(item)),
      ...campaign.locations.map((location) => this.locationCard(location)),
      ...this.sortedScenes(campaign).map((scene) => this.sceneCard(scene)),
      ...campaign.encounters.map((encounter) =>
        this.encounterCard(encounter)
      ),
      ...campaign.antagonistOptions.map((option) => this.optionCard(option)),
      ...campaign.rewards.map((reward, index) =>
        this.rewardCard(reward, index)
      ),
      ...rules.spells.map((spell) => this.spellCard(spell)),
      ...rules.feats.map((feat) => this.featCard(feat)),
      ...rules.skills.map((skill) => this.skillCard(skill)),
      ...rules.equipment.map((item) => this.equipmentCard(item)),
    ];
  }

  private sortedScenes(campaign: Campaign): CampaignScene[] {
    return campaign.scenes.slice().sort((a, b) => a.order - b.order);
  }

  private npcCard(npc: CampaignNpc): CompendiumCard {
    const statBlock = npc.statBlock;
    return {
      key: `npc:${npc.id}`,
      name: npc.name,
      kicker: npc.role,
      summary: npc.summary,
      tags: npc.tags,
      meta: [
        ...(npc.ancestry ? [`Linaje: ${npc.ancestry}`] : []),
        ...(npc.age ? [`Edad: ${npc.age}`] : []),
        npc.faction,
        npc.motivation,
        ...(npc.description ? [`Aspecto: ${npc.description}`] : []),
      ],
      bullets: [
        ...(npc.knowledge ?? []).map((entry) => `Sabe: ${entry}`),
        ...(npc.reactions ?? []).map((entry) => `Reacción: ${entry}`),
        ...(npc.secret ? [`Secreto: ${npc.secret}`] : []),
      ],
      detailSections: statBlock
        ? [
            {
              title: 'Personalidad',
              entries: npc.personality?.length
                ? npc.personality
                : ['No definida.'],
            },
            {
              title: 'Características',
              compact: true,
              entries: [
                `FUE ${statBlock.abilities.strength}`,
                `DES ${statBlock.abilities.dexterity}`,
                `CON ${statBlock.abilities.constitution}`,
                `INT ${statBlock.abilities.intelligence}`,
                `SAB ${statBlock.abilities.wisdom}`,
                `CAR ${statBlock.abilities.charisma}`,
              ],
            },
            {
              title: 'Salvaciones',
              entries: statBlock.saves.length
                ? statBlock.saves
                : ['Sin bonificadores adicionales.'],
            },
            {
              title: 'Habilidades',
              entries: statBlock.skills.length
                ? statBlock.skills
                : ['Sin competencias adicionales.'],
            },
            {
              title: 'Rasgos',
              entries: statBlock.features.length
                ? statBlock.features
                : ['Sin rasgos especiales.'],
            },
            {
              title: 'Ataques',
              entries: statBlock.attacks.length
                ? statBlock.attacks
                : ['Sin ataques registrados.'],
            },
            {
              title: 'Conjuros',
              entries: statBlock.spells.length
                ? statBlock.spells
                : ['No dispone de conjuros.'],
            },
            {
              title: 'Equipo',
              entries: statBlock.equipment.length
                ? statBlock.equipment
                : ['Sin equipo registrado.'],
            },
          ]
        : undefined,
      ...(statBlock
        ? {
            stats: [
              { label: 'CA', value: String(statBlock.armorClass) },
              { label: 'PG', value: String(statBlock.hitPoints) },
              { label: 'Vel.', value: statBlock.speed },
              { label: 'Init.', value: statBlock.initiative },
              {
                label: statBlock.challenge ? 'Desafío' : 'Compet.',
                value: statBlock.challenge ?? `+${statBlock.proficiencyBonus}`,
              },
            ],
          }
        : {}),
      portrait: NPC_PORTRAITS[npc.id],
      tokenUrl: this.tokenPath('npcs', npc.id),
    };
  }

  private playerCard(player: PlayerOption): CompendiumCard {
    return {
      key: `player:${player.id}`,
      name: player.name,
      kicker: `${player.className} - ${player.ancestry}`,
      summary: player.hook,
      tags: [player.className, player.ancestry, player.background],
      meta: [
        `Subclase: ${player.subclass}`,
        `Trasfondo: ${player.background} - dote ${player.feat}`,
        this.abilityLine(player.abilities),
        `Salvaciones: ${player.saves.join(', ')}`,
        `Habilidades: ${player.skills.join(', ')}`,
      ],
      bullets: [
        ...player.attacks.map((entry) => `Ataque: ${entry}`),
        ...player.features.map((entry) => `Rasgo: ${entry}`),
        ...player.spells.map((entry) => `Conjuro: ${entry}`),
        ...player.equipment.map((entry) => `Equipo: ${entry}`),
      ],
      stats: [
        { label: 'CA', value: String(player.armorClass) },
        { label: 'PG', value: String(player.hitPoints) },
        { label: 'Vel.', value: player.speed },
        { label: 'Init.', value: player.initiative },
        { label: 'Compet.', value: `+${player.proficiencyBonus}` },
      ],
      tokenUrl: this.tokenPath('players', player.id),
    };
  }

  private genericNpcCard(npc: RuleGenericNpc): CompendiumCard {
    return {
      key: `generic-npc:${npc.id}`,
      name: npc.name,
      kicker: `${npc.category} · ${npc.role}`,
      summary: npc.summary,
      tags: npc.tags,
      meta: [
        `Tipo o linaje: ${npc.lineage}`,
        `Función: ${npc.role}`,
        `Competencia: +${npc.proficiencyBonus}`,
      ],
      bullets: [],
      stats: [
        { label: 'CA', value: String(npc.armorClass) },
        { label: 'PG', value: String(npc.hitPoints) },
        { label: 'Vel.', value: npc.speed },
        { label: 'Init.', value: npc.initiative },
        { label: 'VD', value: npc.challenge },
      ],
      detailSections: [
        {
          title: 'Personalidad',
          entries: npc.personality.length
            ? npc.personality
            : ['No definida.'],
        },
        {
          title: 'Características',
          compact: true,
          entries: [
            `FUE ${npc.abilities.strength}`,
            `DES ${npc.abilities.dexterity}`,
            `CON ${npc.abilities.constitution}`,
            `INT ${npc.abilities.intelligence}`,
            `SAB ${npc.abilities.wisdom}`,
            `CAR ${npc.abilities.charisma}`,
          ],
        },
        {
          title: 'Salvaciones',
          entries: npc.saves.length
            ? npc.saves
            : ['Sin bonificadores adicionales.'],
        },
        {
          title: 'Habilidades',
          entries: npc.skills.length
            ? npc.skills
            : ['Sin competencias adicionales.'],
        },
        {
          title: 'Rasgos',
          entries: npc.traits.length
            ? npc.traits
            : ['Sin rasgos especiales.'],
        },
        {
          title: 'Ataques',
          entries: npc.attacks.length
            ? npc.attacks
            : ['Sin ataques registrados.'],
        },
        {
          title: 'Conjuros',
          entries: npc.spells.length
            ? npc.spells
            : ['No dispone de conjuros.'],
        },
        {
          title: 'Equipo',
          entries: npc.equipment.length
            ? npc.equipment
            : ['Sin equipo registrado.'],
        },
      ],
      tokenUrl: `assets/tokens/generic/${npc.id}.png`,
      gridTokenUrl: `assets/tokens-grid/generic/${npc.id}.png`,
      tokenPreview: true,
    };
  }

  private npcTokenCard(npc: CampaignNpc): CompendiumCard {
    return {
      key: `token:npc:${npc.id}`,
      name: npc.name,
      kicker: `PNJ - ${npc.role}`,
      summary: npc.summary,
      tags: ['PNJ', ...npc.tags],
      meta: [npc.faction],
      bullets: [],
      tokenUrl: this.tokenPath('npcs', npc.id),
      gridTokenUrl: this.gridTokenPath('npcs', npc.id),
      tokenPreview: true,
    };
  }

  private playerTokenCard(player: PlayerOption): CompendiumCard {
    return {
      key: `token:player:${player.id}`,
      name: player.name,
      kicker: `PJ - ${player.className}`,
      summary: player.hook,
      tags: ['PJ', player.className, player.ancestry, player.subclass],
      meta: [
        `Linaje: ${player.ancestry}`,
        `Subclase: ${player.subclass}`,
        `Trasfondo: ${player.background}`,
      ],
      bullets: [],
      tokenUrl: this.tokenPath('players', player.id),
      gridTokenUrl: this.gridTokenPath('players', player.id),
      tokenPreview: true,
    };
  }

  private namedPlayerTokenCard(
    player: CampaignPlayerCharacter
  ): CompendiumCard {
    return {
      key: `token:named-player:${player.id}`,
      name: player.name,
      kicker: `PJ - ${player.className}`,
      summary: player.summary,
      tags: Array.from(
        new Set([
          'PJ',
          player.className,
          player.ancestry,
          player.subclass,
          ...player.tags,
        ])
      ),
      meta: [
        `Linaje: ${player.ancestry}`,
        `Subclase: ${player.subclass}`,
        `Trasfondo: ${player.background}`,
        `Afiliación: ${player.affiliation}`,
      ],
      bullets: [],
      tokenUrl: player.tokenUrl,
      gridTokenUrl: player.gridTokenUrl,
      tokenPreview: true,
    };
  }

  private itemCard(item: CampaignItem): CompendiumCard {
    return {
      key: `campaign-item:${item.id}`,
      name: item.name,
      kicker: item.kind,
      summary: item.summary,
      tags: item.tags,
      meta: item.magic ? [`Magia: ${item.magic}`] : [],
      bullets: item.properties,
    };
  }

  private locationCard(location: CampaignLocation): CompendiumCard {
    return {
      key: `location:${location.id}`,
      name: location.name,
      kicker: location.region,
      summary: location.summary,
      tags: location.tags,
      meta: [location.purpose],
      bullets: location.details,
      mapUrl: location.mapUrl,
      vttUrl: this.vttPath('location', location.id),
    };
  }

  private sceneCard(scene: CampaignScene): CompendiumCard {
    return {
      key: `scene:${scene.id}`,
      name: scene.name,
      kicker: `${scene.act} - escena ${scene.order}`,
      summary: scene.objective,
      tags: Array.from(new Set([scene.act, ...scene.tags])),
      meta: [
        ...(scene.readAloud ? [`Leer: ${scene.readAloud}`] : []),
        ...scene.checks.map(
          (check) => `${check.skill} CD ${check.dc}: ${check.result}`
        ),
      ],
      bullets: [
        ...scene.clues.map((clue) => `Pista: ${clue}`),
        ...(scene.outcomes ?? []).map((outcome) => `Avance: ${outcome}`),
        ...(scene.gmNotes ?? []).map((note) => `DM: ${note}`),
      ],
      mapUrl: scene.mapUrl,
      vttUrl: this.vttPath('scene', scene.id),
    };
  }

  private encounterCard(encounter: CampaignEncounter): CompendiumCard {
    return {
      key: `encounter:${encounter.id}`,
      name: encounter.name,
      kicker: `${encounter.act} - ${encounter.difficulty}`,
      summary: encounter.summary,
      tags: Array.from(new Set([encounter.act, ...encounter.tags])),
      meta: [
        `Lugar: ${encounter.location}`,
        `Objetivo: ${encounter.objective}`,
        `Enemigos: ${encounter.combatants.join(', ')}`,
      ],
      bullets: [
        ...encounter.scaling.map((entry) => `Ajuste: ${entry}`),
        ...encounter.terrain.map((entry) => `Terreno: ${entry}`),
        ...encounter.tactics.map((entry) => `Táctica: ${entry}`),
        ...encounter.developments.map((entry) => `Desenlace: ${entry}`),
      ],
      mapUrl: encounter.mapUrl,
      vttUrl: this.vttPath('encounter', encounter.id),
    };
  }

  private spellCard(spell: RuleSpell): CompendiumCard {
    return {
      key: `spell:${spell.id}`,
      name: spell.name,
      kicker: spell.level === 0 ? `Truco de ${spell.school}` : `${spell.school} - nivel ${spell.level}`,
      summary: spell.summary,
      description: spell.description,
      tags: spell.tags,
      meta: [
        `Clases: ${spell.classes.join(', ')}`,
        `Lanzamiento: ${spell.castingTime}`,
        `Alcance: ${spell.range}`,
        `Componentes: ${spell.components}`,
        `Duración: ${spell.duration}`,
      ],
      bullets: [`Manual del Jugador, página ${spell.sourcePage}`],
    };
  }

  private featCard(feat: RuleFeat): CompendiumCard {
    return {
      key: `feat:${feat.id}`,
      name: feat.name,
      kicker: feat.category,
      summary: feat.summary,
      description: feat.description,
      tags: feat.tags,
      meta: feat.requirements ? [`Requisitos: ${feat.requirements}`] : [],
      bullets: [
        ...(feat.repeatable ? ['Puede elegirse más de una vez.'] : []),
        `Manual del Jugador, página ${feat.sourcePage}`,
      ],
    };
  }

  private skillCard(skill: RuleSkill): CompendiumCard {
    return {
      key: `skill:${skill.id}`,
      name: skill.name,
      kicker: skill.ability,
      summary: skill.summary,
      description: skill.description,
      tags: skill.tags,
      meta: [],
      bullets: [
        ...skill.uses,
        `Manual del Jugador, página ${skill.sourcePage}`,
      ],
    };
  }

  private equipmentCard(item: RuleEquipment): CompendiumCard {
    return {
      key: `equipment:${item.id}`,
      name: item.name,
      kicker: item.category,
      summary: item.summary,
      description: item.description,
      tags: item.tags,
      meta: [
        `Precio: ${item.cost}`,
        ...(item.weight ? [`Peso: ${item.weight}`] : []),
      ],
      bullets: [
        ...item.properties,
        `Manual del Jugador, página ${item.sourcePage}`,
      ],
    };
  }

  private optionCard(option: CampaignOption): CompendiumCard {
    return {
      key: `antagonist:${option.id}`,
      name: option.name,
      kicker: 'Opción de antagonista',
      summary: option.summary,
      tags: ['Antagonista', option.name],
      meta: [],
      bullets: [],
    };
  }

  private rewardCard(reward: string, index: number): CompendiumCard {
    return {
      key: `reward:${index}`,
      name: reward,
      kicker: `Recompensa ${index + 1}`,
      summary: 'Beneficio potencial por resolver el encargo de la carta.',
      tags: ['Recompensa'],
      meta: [],
      bullets: [],
    };
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private tokenPath(group: 'npcs' | 'players', id: string): string {
    return `assets/tokens/${group}/${id}.png`;
  }

  private gridTokenPath(group: 'npcs' | 'players', id: string): string {
    return `assets/tokens-grid/${group}/${id}.png`;
  }

  private vttPath(
    kind: 'scene' | 'encounter' | 'location',
    id: string
  ): string {
    return `/vtt/${this.campaignId}/${kind}/${id}`;
  }

  private abilityLine(abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  }): string {
    return `Fue ${abilities.strength} - Des ${abilities.dexterity} - Con ${abilities.constitution} - Int ${abilities.intelligence} - Sab ${abilities.wisdom} - Car ${abilities.charisma}`;
  }
}
