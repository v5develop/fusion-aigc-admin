<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">头条管理</h2>
      <a-space>
        <a-tag v-if="isPlazaMock()" color="orange">mock 数据</a-tag>
        <a-button v-permission="'creaft_catalog:edit'" :loading="refreshing" @click="doRefresh">
          立即刷新
        </a-button>
        <a-button
          v-permission="'creaft_catalog:edit'"
          type="primary"
          :disabled="isGlobal || historyMode"
          @click="openRecommend(null)"
        >
          手动推荐
        </a-button>
      </a-space>
    </div>

    <a-card
      v-if="tab !== 'compare' && tab !== 'snapshots'"
      variant="borderless"
      style="margin-bottom: 12px"
      :loading="scopesLoading && !scopes.length"
    >
      <div class="chips" role="group" aria-label="榜单范围">
        <a-button
          :type="isGlobal ? 'primary' : 'default'"
          size="small"
          @click="switchScope(GLOBAL_SCOPE)"
        >
          全站总榜
          <a-tag color="orange" style="margin-left: 6px">仅后台可见</a-tag>
        </a-button>
        <a-button
          v-for="s in industryScopes"
          :key="s.scope"
          :type="scope === s.scope ? 'primary' : 'default'"
          size="small"
          @click="switchScope(s.scope)"
        >
          {{ s.parentCode ? '　' : '' }}{{ s.name }}
          <a-tag v-if="s.coldStart" style="margin-left: 4px">补位</a-tag>
          <a-tag v-else-if="!s.computed" style="margin-left: 4px">待计算</a-tag>
        </a-button>
      </div>
    </a-card>

    <a-tabs v-model:active-key="tab" @change="onTabChange">
      <a-tab-pane key="board" tab="当前榜单" />
      <a-tab-pane key="params" tab="榜单参数" />
      <a-tab-pane key="rules" tab="规则与抑制" />
      <a-tab-pane key="compare" tab="并排对比" />
      <a-tab-pane key="snapshots" tab="历史快照" />
    </a-tabs>

    <!-- ===================== 当前榜单 ===================== -->
    <template v-if="tab === 'board'">
      <div class="history-bar">
        <span class="muted">版本</span>
        <a-select
          v-model:value="viewVersion"
          allow-clear
          placeholder="最新版本"
          :options="snapshotOptions"
          style="width: 360px"
          @change="loadBoard"
        />
        <span v-if="historyMode" class="muted">历史版本只读，写操作请回到最新版本</span>
      </div>

      <a-alert
        v-if="noSnapshot"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="还没有生成过榜单，请先点右上角「立即刷新」"
      />
      <a-alert
        v-if="board"
        :type="board.snapshot.stale && !historyMode ? 'warning' : 'info'"
        show-icon
        style="margin-bottom: 12px"
      >
        <template #message>
          <a-space wrap>
            <span>版本 v{{ board.snapshot.version }}</span>
            <span>{{ historyMode ? '计算于' : '更新于' }} {{ ageText }}</span>
            <a-tag :color="board.snapshot.signalSource === 'REDIS' ? 'green' : 'orange'">
              {{ board.snapshot.signalSource === 'REDIS' ? '实时计数 Redis' : '降级读库 DB' }}
            </a-tag>
            <a-tag v-if="board.snapshot.stale && !historyMode" color="red">榜单陈旧</a-tag>
            <span class="muted">触发：{{ triggerLabel(board.snapshot.trigger) }}</span>
            <span class="muted">参数 {{ board.snapshot.paramsHash.slice(0, 8) }}</span>
          </a-space>
        </template>
      </a-alert>

      <a-alert
        v-if="isGlobal"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        message="全站总榜只用来发现跨行业的爆款和缺口，用户端取不到。在任意一行上推荐 / 屏蔽时，范围只能选该模板所属的行业。"
      />
      <a-alert
        v-else-if="currentSummary?.coldStart"
        type="info"
        show-icon
        style="margin-bottom: 12px"
        :message="`冷启动补位中：合格模板不足 ${topNText} 条，已用本行业最新上架补位`"
      />

      <a-card variant="borderless" style="margin-bottom: 12px">
        <a-table
          :columns="boardColumns"
          :data-source="board?.items ?? []"
          :loading="boardLoading"
          :pagination="false"
          row-key="plazaTemplateId"
          size="middle"
          :scroll="{ x: 1100 }"
        >
          <template #emptyText>
            <a-empty description="这个范围暂时没有可上榜的模板" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'rank'">
              <b :class="{ top: record.rank <= 3 }">{{ String(record.rank).padStart(2, '0') }}</b>
            </template>
            <template v-else-if="column.dataIndex === 'title'">
              <div class="tpl-cell">
                <img
                  v-if="record.template.cover"
                  :src="record.template.cover"
                  class="thumb"
                  alt=""
                />
                <div v-else class="thumb thumb-empty">无图</div>
                <div>
                  <div class="title-cell">
                    {{ record.template.exists ? record.template.title : '（模板已不在目录）' }}
                  </div>
                  <code class="route-code">#{{ record.plazaTemplateId }}</code>
                  <a-tag v-if="record.pinPosition" color="purple" style="margin-left: 4px">
                    已定位 #{{ record.pinPosition }}
                  </a-tag>
                  <a-tag v-if="record.isNew" color="green" style="margin-left: 4px">新</a-tag>
                </div>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'source'">
              <a-tag :color="sourceMeta[sourceKey(record)].color">
                {{ sourceMeta[sourceKey(record)].label }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'score'">
              <a-popover v-if="record.score !== null" trigger="click" title="分数明细">
                <template #content>
                  <ScoreDetail :item="record" />
                </template>
                <a-button size="small">{{ record.score }} 分</a-button>
              </a-popover>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.dataIndex === 'why'">
              <a-input
                v-if="canWrite"
                :value="whyDraft[record.plazaTemplateId] ?? record.why ?? ''"
                :maxlength="60"
                size="small"
                :disabled="isGlobal"
                :placeholder="isGlobal ? '' : '点此写推荐语，保存即接管'"
                @update:value="(v: string) => (whyDraft[record.plazaTemplateId] = v)"
                @blur="saveWhy(record)"
                @press-enter="saveWhy(record)"
              />
              <span v-else>{{ record.why || '—' }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'uses7d'">
              <template v-if="record.source !== 'FILL'">
                <div>
                  {{ record.uses7d }} 次
                  <span :class="trendClass(record.trend)">{{ trendText(record.trend) }}</span>
                </div>
                <div class="muted">去重用户 {{ record.uniqueUsers ?? '—' }}</div>
              </template>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-space :size="2" wrap>
                <a-popover v-if="!isGlobal && canWrite" trigger="click" title="定位到名次">
                  <template #content>
                    <a-input-number v-model:value="posDraft" :min="1" :max="50" size="small" />
                    <a-button
                      size="small"
                      type="primary"
                      style="margin-left: 6px"
                      @click="setPosition(record, posDraft)"
                    >
                      确定
                    </a-button>
                    <a-button
                      v-if="record.pinPosition"
                      size="small"
                      style="margin-left: 6px"
                      @click="setPosition(record, null)"
                    >
                      取消定位
                    </a-button>
                  </template>
                  <a-button
                    size="small"
                    type="link"
                    @click="posDraft = record.pinPosition ?? record.rank"
                    >定位</a-button
                  >
                </a-popover>
                <a-button
                  v-if="record.headlineId && canWrite"
                  size="small"
                  type="link"
                  @click="cancelRule(record)"
                >
                  取消推荐
                </a-button>
                <a-button
                  v-if="canWrite"
                  size="small"
                  type="link"
                  danger
                  @click="openSuppress(record)"
                >
                  取消到某日 / 屏蔽
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>

      <a-collapse v-if="board?.nearMiss?.length" ghost style="margin-bottom: 12px">
        <a-collapse-panel key="near" :header="`差一点的候选（接下来 ${board.nearMiss.length} 个）`">
          <a-table
            :columns="nearColumns"
            :data-source="board.nearMiss"
            :pagination="false"
            row-key="plazaTemplateId"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'title'">
                {{ record.template.title }}
                <code class="route-code">#{{ record.plazaTemplateId }}</code>
              </template>
              <template v-else-if="column.dataIndex === 'score'">
                {{ record.score }}
                <span class="muted">（有效 {{ record.effScore }}）</span>
              </template>
              <template v-else-if="column.dataIndex === 'reason'">
                {{ SKIP_LABEL[record.reason] ?? record.reason }}
              </template>
              <template v-else-if="column.dataIndex === 'gap'">
                {{ record.gap > 0 ? `差 ${record.gap}` : '—' }}
              </template>
              <template v-else-if="column.key === 'operation'">
                <a-button
                  v-if="canWrite && !isGlobal"
                  size="small"
                  type="link"
                  @click="openRecommend(record)"
                >
                  手动推荐
                </a-button>
              </template>
            </template>
          </a-table>
          <div v-if="Object.keys(board.skip ?? {}).length" class="muted" style="margin-top: 6px">
            跳过统计：{{
              Object.entries(board.skip)
                .map(([k, v]) => `${SKIP_LABEL[k] ?? k} ${v}`)
                .join(' · ')
            }}
          </div>
        </a-collapse-panel>
      </a-collapse>
    </template>

    <!-- ===================== 榜单参数 ===================== -->
    <template v-else-if="tab === 'params'">
      <a-card v-if="params" variant="borderless" title="全局参数">
        <template #extra>
          <a-space>
            <a-button :loading="previewing" @click="doPreviewParams">试算</a-button>
            <a-button
              v-permission="'creaft_catalog:edit'"
              type="primary"
              :loading="savingParams"
              @click="doSaveParams"
            >
              保存并刷新
            </a-button>
          </a-space>
        </template>
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 12px"
          message="先点「试算」看与当前榜单的差异再保存；防刷参数改动后，历史小时在下次校准后才按新规则重算。"
        />
        <div v-for="g in paramGroups" :key="g.name" class="pgroup">
          <div class="pgroup-title">{{ g.name }}</div>
          <div class="pgrid">
            <div v-for="f in g.fields" :key="f.key" class="pitem">
              <div class="plabel">
                {{ f.label }}
                <code class="route-code">{{ f.key }}</code>
              </div>
              <a-switch
                v-if="f.kind === 'boolean'"
                :checked="!!getPath(paramsDraft.global, f.key)"
                @update:checked="(v: boolean) => setPath(paramsDraft.global, f.key, v)"
              />
              <a-select
                v-else-if="f.kind === 'enum'"
                :value="getPath(paramsDraft.global, f.key) as string"
                :options="SCORE_NORMALIZE_OPTIONS"
                style="width: 100%"
                @update:value="(v: string) => setPath(paramsDraft.global, f.key, v)"
              />
              <a-input-number
                v-else
                :value="getPath(paramsDraft.global, f.key) as number"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                style="width: 100%"
                @update:value="
                  (v: number | null) => v !== null && setPath(paramsDraft.global, f.key, v)
                "
              />
              <div class="muted">
                默认 {{ String(getPath(params.defaults, f.key)) }}
                <template v-if="f.kind === 'number'"> · 范围 {{ f.min }}~{{ f.max }}</template>
              </div>
              <div v-if="paramErrors[f.key]" class="err">{{ paramErrors[f.key] }}</div>
            </div>
          </div>
        </div>
      </a-card>

      <a-card
        v-if="params"
        variant="borderless"
        style="margin-top: 12px"
        :title="isGlobal ? '行业覆盖' : `行业覆盖：${scopeName(scope)}`"
      >
        <a-alert
          v-if="isGlobal"
          type="info"
          show-icon
          message="全站总榜没有覆盖项。请先在上方切换到某个行业，再为它单独设置。"
        />
        <div v-else class="pgrid">
          <div v-for="k in OVERRIDE_KEYS" :key="k" class="pitem">
            <div class="plabel">{{ overrideLabel[k] }}（{{ k }}）</div>
            <a-input-number
              :value="paramsDraft.overrides[scope]?.[k]"
              :min="metaOf(k)?.min"
              :max="metaOf(k)?.max"
              :placeholder="`留空 = 用全局 ${paramsDraft.global[k] ?? ''}`"
              style="width: 100%"
              @update:value="(v: number | null) => setOverride(k, v)"
            />
            <div v-if="paramErrors[`overrides.${scope}.${k}`]" class="err">
              {{ paramErrors[`overrides.${scope}.${k}`] }}
            </div>
          </div>
        </div>
      </a-card>
    </template>

    <!-- ===================== 规则与抑制 ===================== -->
    <template v-else-if="tab === 'rules'">
      <a-card
        variant="borderless"
        :title="isGlobal ? '人工推荐（全部范围）' : '人工推荐（当前范围）'"
        style="margin-bottom: 12px"
      >
        <template #extra>
          <a-select
            v-model:value="rulePhase"
            :options="rulePhaseOptions"
            style="width: 130px"
            @change="reloadRules"
          />
        </template>
        <a-table
          :columns="ruleColumns"
          :data-source="rules"
          :loading="rulesLoading"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #emptyText><a-empty description="没有人工推荐规则" /></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'title'">
              {{ record.template.title }}
              <code class="route-code">#{{ record.plazaTemplateId }}</code>
            </template>
            <template v-else-if="column.dataIndex === 'window'">
              {{ record.startDate }} ~ {{ record.endDate }}
              <a-tag :color="phaseMeta[record.phase as RulePhase].color" style="margin-left: 4px">
                {{ phaseMeta[record.phase as RulePhase].label }}
              </a-tag>
              <a-tag v-if="!record.enabled">已停用</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'pin'">
              {{ record.pinPosition ? `#${record.pinPosition}` : '—' }}
            </template>
            <template v-else-if="column.dataIndex === 'origin'">
              {{ record.adoptedFromAuto ? '接管算法项' : '手动推荐' }}
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-space :size="2">
                <a-button
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  danger
                  @click="removeRule(record, false)"
                >
                  取消推荐
                </a-button>
                <a-button
                  v-if="record.batchId"
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  danger
                  @click="removeRule(record, true)"
                >
                  同批一起取消
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
        <div class="pager">
          <span class="muted">共 {{ rulesTotal }} 条</span>
          <a-pagination
            v-model:current="rulePage"
            :page-size="ruleSize"
            :total="rulesTotal"
            :show-size-changer="false"
            @change="loadRules"
          />
        </div>
      </a-card>

      <a-card variant="borderless" title="抑制名单（取消 / 屏蔽）">
        <template #extra>
          <a-switch
            v-model:checked="onlyActive"
            checked-children="仅生效中"
            un-checked-children="含过期"
          />
        </template>
        <a-table
          :columns="supColumns"
          :data-source="suppressions"
          :loading="supLoading"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #emptyText><a-empty description="没有抑制项" /></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'title'">
              {{ record.templateTitle }}
              <code class="route-code">#{{ record.plazaTemplateId }}</code>
            </template>
            <template v-else-if="column.dataIndex === 'scope'">
              {{ record.scopeName || scopeName(record.scope) }}
            </template>
            <template v-else-if="column.dataIndex === 'kind'">
              <a-tag v-if="record.permanent" color="red">永久屏蔽</a-tag>
              <a-tag v-else color="orange">取消到 {{ record.untilAt?.replace('T', ' ') }}</a-tag>
              <span v-if="!record.permanent" class="muted">{{ remaining(record.untilAt) }}</span>
            </template>
            <template v-else-if="column.key === 'operation'">
              <a-space :size="2">
                <a-button
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  @click="removeSuppression(record, false)"
                >
                  解除
                </a-button>
                <a-button
                  v-if="record.batchId"
                  v-permission="'creaft_catalog:edit'"
                  size="small"
                  type="link"
                  @click="removeSuppression(record, true)"
                >
                  同批一起解除
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </template>

    <!-- ===================== 并排对比 / 历史快照 ===================== -->
    <HeadlineCompare v-else-if="tab === 'compare'" :scopes="scopes" />
    <HeadlineSnapshots
      v-else-if="tab === 'snapshots'"
      :scopes="scopes"
      @open-in-board="openInBoard"
    />

    <!-- 弹窗 -->
    <RecommendModal
      v-model:open="recommendOpen"
      :fixed-target="recommendTarget"
      :default-scope="isGlobal ? undefined : scope"
      :suppressions="suppressions"
      @done="afterWrite"
    />
    <SuppressModal
      v-model:open="suppressOpen"
      :target="suppressTarget"
      :default-scope="isGlobal ? undefined : scope"
      :scope-catalog="scopes"
      @done="afterWrite"
    />
    <a-modal v-model:open="diffOpen" title="试算结果（相对当前榜单）" :footer="null" width="640px">
      <DiffView v-if="previewResult" :diff="previewResult.diff" :titles="titleMap" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next';
import dayjs from 'dayjs';
import { computed, h, onMounted, reactive, ref, watch, defineComponent, type PropType } from 'vue';

import {
  GLOBAL_SCOPE,
  OVERRIDE_KEYS,
  PlazaError,
  deleteHeadlineRule,
  deleteHeadlineSuppression,
  getHeadlineCurrent,
  getHeadlineParams,
  getHeadlineRules,
  getHeadlineScopes,
  getHeadlineSnapshot,
  getHeadlineSnapshots,
  getHeadlineSuppressions,
  isPlazaMock,
  positionHeadline,
  previewHeadlines,
  refreshHeadlines,
  saveHeadlineParams,
  updateHeadlineWhy,
  type HeadlineBoard,
  type HeadlineDiff,
  type HeadlineItem,
  type HeadlineNearMiss,
  type HeadlineOverride,
  type HeadlineParamsView,
  type HeadlinePreviewResult,
  type HeadlineRule,
  type HeadlineScopeSummary,
  type HeadlineSnapshotMeta,
  type HeadlineSuppression,
} from '@/api/plaza-admin';
import { usePermission } from '@/composables/usePermission';

import HeadlineCompare from './HeadlineCompare.vue';
import HeadlineSnapshots from './HeadlineSnapshots.vue';
import {
  SCORE_NORMALIZE_OPTIONS,
  buildFields,
  clone,
  getPath,
  groupFields,
  setPath,
} from './params-model';
import RecommendModal from './RecommendModal.vue';
import SuppressModal from './SuppressModal.vue';

const { can } = usePermission();
const canEdit = computed(() => can('creaft_catalog:edit'));

/** 展示用来源：Go 只有 AUTO / MANUAL / FILL，接管算法项产生的人工项是 MANUAL + adopted */
type SourceKey = 'AUTO' | 'MANUAL' | 'MANUAL_ADOPTED' | 'FILL';
const sourceMeta: Record<SourceKey, { label: string; color: string }> = {
  AUTO: { label: '算法', color: 'blue' },
  MANUAL: { label: '人工', color: 'purple' },
  MANUAL_ADOPTED: { label: '人工·接管', color: 'magenta' },
  FILL: { label: '新上架补位', color: 'default' },
};
const sourceKey = (i: HeadlineItem): SourceKey =>
  i.source === 'MANUAL' && i.adopted ? 'MANUAL_ADOPTED' : i.source;

const SIGNAL_LABEL: Record<string, string> = {
  decay: '衰减热度（越近权重越高）',
  velocity: '近 24h 增速',
  fresh: '新鲜度',
  users: '去重用户数',
  ctr: '点击率（预留）',
};

const SKIP_LABEL: Record<string, string> = {
  NOT_IN_SCOPE: '不属于该范围',
  TEMPLATE_DISABLED: '模板不可见',
  SUPPRESSED: '被取消 / 屏蔽',
  MANUAL_EXISTS: '已有人工推荐',
  BELOW_MIN_DECAYED: '衰减热度未达门槛',
  BELOW_MIN_USERS: '去重用户数未达门槛',
  DIVERSITY_MEDIA: '同类媒体已满',
  CUT_BY_SLOTS: '名额已满',
};

const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED: '定时',
  OPS: '运营写操作',
  REFRESH_NOW: '立即刷新',
  STARTUP: '启动',
};
const triggerLabel = (t: string) => TRIGGER_LABEL[t] ?? t;

/** 分数明细弹层：逐信号 原始值 × 权重 = 贡献，再给稳定性痕迹 */
const ScoreDetail = defineComponent({
  props: { item: { type: Object as PropType<HeadlineItem>, required: true } },
  setup(props) {
    const line = (k: string, v: string) =>
      h('div', { style: 'display:flex;justify-content:space-between;gap:16px' }, [
        h('span', k),
        h('b', v),
      ]);
    return () => {
      const d = props.item.scoreDetail;
      if (!d) return h('div', { style: 'min-width:200px' }, '这一项没有分数明细');
      const sig = Object.entries(d.signals).map(([k, s]) =>
        line(
          SIGNAL_LABEL[k] ?? k,
          s.raw === null ? '—' : `${s.raw} × ${s.w} = ${Math.round(s.v * 10000) / 10000}`,
        ),
      );
      const st = d.stability;
      const extra = [
        st.incumbent ? '在榜项（迟滞打折后参与比较）' : '',
        st.dwellProtected ? '驻留保护中，未被挤出' : '',
        st.rankMovedFrom !== null ? `名次限动：原应在第 ${st.rankMovedFrom} 名` : '',
        d.pickedBy === 'DWELL' ? '因最短驻留保留' : '',
      ].filter(Boolean);
      return h('div', { style: 'min-width:280px;font-size:13px' }, [
        ...sig,
        line(
          '入选门槛',
          `衰减 ≥ ${d.thresholds.effMinDecayed} · 用户 ≥ ${d.thresholds.effMinUsers}`,
        ),
        line('近 7 天 / 前 7 天', `${d.stats.uses7d} / ${d.stats.prevUses7d}`),
        ...extra.map((t) => h('div', { style: 'color:#d46b08;font-size:12px' }, t)),
        h(
          'div',
          { style: 'margin-top:8px;color:#888;font-size:12px' },
          '算法确定、可解释，不用 AI 猜。同一用户同模板每天最多计入有限次。',
        ),
      ]);
    };
  },
});

/** 试算 diff：进入 / 退出 / 名次变化。试算条目不带模板摘要，标题取自当前榜单，取不到就显示 #id */
const DiffView = defineComponent({
  props: {
    diff: { type: Object as PropType<HeadlineDiff>, required: true },
    titles: { type: Object as PropType<Record<number, string>>, required: true },
  },
  setup(props) {
    const name = (id: number) => props.titles[id] ?? `#${id}`;
    const block = (title: string, lines: string[]) =>
      h('div', { style: 'margin-bottom:12px' }, [
        h('b', `${title}（${lines.length}）`),
        ...(lines.length
          ? lines.map((l) => h('div', { style: 'font-size:13px' }, l))
          : [h('div', { style: 'color:#888;font-size:13px' }, '无')]),
      ]);
    return () => [
      block(
        '新进榜',
        props.diff.enter.map((id) => `+ ${name(id)}`),
      ),
      block(
        '掉出榜',
        props.diff.exit.map((id) => `- ${name(id)}`),
      ),
      block(
        '名次变化',
        props.diff.moved.map((m) => `${name(m.plazaTemplateId)}：第 ${m.from} 名 → 第 ${m.to} 名`),
      ),
    ];
  },
});

// ---------------- 范围 ----------------
const scopes = ref<HeadlineScopeSummary[]>([]);
const scopesLoading = ref(false);
const scope = ref<string>(GLOBAL_SCOPE);
const isGlobal = computed(() => scope.value === GLOBAL_SCOPE);
const industryScopes = computed(() => scopes.value.filter((s) => s.scope !== GLOBAL_SCOPE));
const currentSummary = computed(() => scopes.value.find((s) => s.scope === scope.value));
const scopeName = (code: string) =>
  code === GLOBAL_SCOPE ? '全站总榜' : (scopes.value.find((s) => s.scope === code)?.name ?? code);
const topNText = computed(() => String(params.value?.current.global['top-n'] ?? 10));

async function loadScopes() {
  scopesLoading.value = true;
  try {
    scopes.value = (await getHeadlineScopes())?.scopes ?? [];
  } catch {
    /* 已提示 */
  } finally {
    scopesLoading.value = false;
  }
}

function switchScope(s: string) {
  if (scope.value === s) return;
  scope.value = s;
  whyDraft.value = {};
  rulePage.value = 1;
  loadTab();
}

// ---------------- 页签 ----------------
const tab = ref<'board' | 'params' | 'rules' | 'compare' | 'snapshots'>('board');
function onTabChange() {
  loadTab();
}
function loadTab() {
  if (tab.value === 'board') {
    loadBoard();
    loadSuppressions(); // 手动推荐弹窗要据此灰显被抑制的模板
  } else if (tab.value === 'params') loadParams();
  else if (tab.value === 'rules') {
    loadRules();
    loadSuppressions();
  }
  // compare / snapshots：子组件自己加载
}

/** 历史快照页签里「在榜单页打开」：切回当前榜单并固定到该版本 */
function openInBoard(version: number, s: string) {
  scope.value = s;
  viewVersion.value = version;
  tab.value = 'board';
  loadTab();
}

// ---------------- 当前榜单 / 历史版本 ----------------
const board = ref<HeadlineBoard | null>(null);
const boardLoading = ref(false);
const noSnapshot = ref(false);
const whyDraft = ref<Record<number, string>>({});
const posDraft = ref<number | undefined>();

/** 选了某个历史版本（undefined = 最新）；历史版本只读 */
const viewVersion = ref<number | undefined>();
const historyMode = computed(() => viewVersion.value !== undefined);
const canWrite = computed(() => canEdit.value && !historyMode.value);
const snapshots = ref<HeadlineSnapshotMeta[]>([]);
const snapshotOptions = computed(() =>
  snapshots.value.map((m, i) => ({
    label: `v${m.version} · ${m.computedAt.replace('T', ' ')} · ${triggerLabel(m.trigger)}${i === 0 ? '（最新）' : ''}`,
    value: m.version,
  })),
);

async function loadSnapshots() {
  try {
    snapshots.value = (await getHeadlineSnapshots({ page: 1, size: 50 }))?.list ?? [];
  } catch {
    /* 已提示 */
  }
}

const ageText = computed(() => {
  const s = board.value?.snapshot;
  if (!s) return '';
  const when = s.computedAt.replace('T', ' ');
  if (historyMode.value) return when;
  return s.ageMinutes <= 0 ? '刚刚' : `${s.ageMinutes} 分钟前（${when}）`;
});

const boardColumns = [
  { title: '名次', dataIndex: 'rank', width: 64 },
  { title: '模板', dataIndex: 'title', width: 260 },
  { title: '来源', dataIndex: 'source', width: 110 },
  { title: '分数', dataIndex: 'score', width: 90 },
  { title: '推荐语', dataIndex: 'why', width: 220 },
  { title: '近 7 天复刻', dataIndex: 'uses7d', width: 150 },
  { title: '操作', key: 'operation', width: 260, fixed: 'right' as const },
];
const nearColumns = [
  { title: '模板', dataIndex: 'title' },
  { title: '分数', dataIndex: 'score', width: 160 },
  { title: '未入榜原因', dataIndex: 'reason', width: 170 },
  { title: '距门槛', dataIndex: 'gap', width: 90 },
  { title: '近 7 天', dataIndex: 'uses7d', width: 80 },
  { title: '操作', key: 'operation', width: 100 },
];
const ruleColumns = [
  { title: '模板', dataIndex: 'title' },
  { title: '范围', dataIndex: 'scopeName', width: 110 },
  { title: '生效日期', dataIndex: 'window', width: 300 },
  { title: '定位', dataIndex: 'pin', width: 70 },
  { title: '推荐语', dataIndex: 'why' },
  { title: '来源', dataIndex: 'origin', width: 100 },
  { title: '操作', key: 'operation', width: 190 },
];

let boardSeq = 0;
async function loadBoard() {
  const s = ++boardSeq;
  boardLoading.value = true;
  noSnapshot.value = false;
  try {
    const b = viewVersion.value
      ? await getHeadlineSnapshot(viewVersion.value, scope.value, { silent: true })
      : await getHeadlineCurrent(scope.value, { silent: true });
    if (s !== boardSeq) return;
    board.value = b;
  } catch (e) {
    if (s !== boardSeq) return;
    board.value = null;
    if (e instanceof PlazaError && e.reason === 'HEADLINE_SNAPSHOT_EXPIRED') {
      if (historyMode.value) {
        message.warning('该版本已超过保留期，已回到最新版本');
        viewVersion.value = undefined;
        loadSnapshots();
        loadBoard();
      } else noSnapshot.value = true;
    } else message.error(e instanceof Error ? e.message : '加载榜单失败');
  } finally {
    if (s === boardSeq) boardLoading.value = false;
  }
}

/** 试算 diff 里用来显示标题：榜单与候选里已知的模板 */
const titleMap = computed(() => {
  const m: Record<number, string> = {};
  for (const i of board.value?.items ?? []) m[i.plazaTemplateId] = i.template.title;
  for (const i of board.value?.nearMiss ?? []) m[i.plazaTemplateId] = i.template.title;
  return m;
});

const trendText = (t: number | null) =>
  t === null ? '新上榜' : `${t > 0 ? '↑' : t < 0 ? '↓' : ''}${Math.abs(t)}%`;
const trendClass = (t: number | null) =>
  t === null ? 'trend-new' : t > 0 ? 'trend-up' : t < 0 ? 'trend-down' : 'muted';

const refreshing = ref(false);
async function doRefresh() {
  refreshing.value = true;
  try {
    const r = await refreshHeadlines();
    const moved = Object.values(r.diff ?? {}).reduce(
      (n, d) => n + d.enter.length + d.exit.length + d.moved.length,
      0,
    );
    message.success(
      r.refreshed
        ? `已刷新到 v${r.version}${r.diff ? `，共 ${moved} 处变化` : ''}`
        : '已有刷新在进行，稍后自动更新',
    );
    viewVersion.value = undefined;
    await afterWrite();
  } catch {
    /* 已提示 */
  } finally {
    refreshing.value = false;
  }
}

/** 所有写操作后：范围概况、版本列表、当前页签的数据重拉 */
async function afterWrite() {
  await Promise.all([
    loadScopes(),
    loadSnapshots(),
    tab.value === 'board' ? loadBoard() : Promise.resolve(),
    tab.value === 'rules' ? loadRules() : Promise.resolve(),
    loadSuppressions(),
  ]);
}

async function saveWhy(item: HeadlineItem) {
  const draft = whyDraft.value[item.plazaTemplateId];
  if (draft === undefined || draft === (item.why ?? '') || isGlobal.value) return;
  const why = draft.trim();
  if (!why) {
    message.warning('推荐语不能为空');
    whyDraft.value[item.plazaTemplateId] = item.why ?? '';
    return;
  }
  try {
    await updateHeadlineWhy({ plazaTemplateId: item.plazaTemplateId, scope: scope.value, why });
    message.success(item.source === 'AUTO' ? '已接管并保存推荐语' : '已保存');
    delete whyDraft.value[item.plazaTemplateId];
    await afterWrite();
  } catch {
    /* 已提示 */
  }
}

async function setPosition(item: HeadlineItem, pos: number | null | undefined) {
  try {
    await positionHeadline({
      plazaTemplateId: item.plazaTemplateId,
      scope: scope.value,
      position: pos ?? null,
    });
    message.success(pos ? `已定位到第 ${pos} 名` : '已取消定位');
    await afterWrite();
  } catch {
    /* 已提示 */
  }
}

function cancelRule(item: HeadlineItem) {
  if (!item.headlineId) return;
  const ruleId = item.headlineId;
  Modal.confirm({
    title: `取消推荐「${item.template.title}」？`,
    content: item.adopted
      ? '这是接管算法项产生的规则，取消 = 取消接管，回到算法排序。'
      : '人工推荐规则会被删除，模板回到算法评选。',
    okText: '取消推荐',
    onOk: async () => {
      try {
        await deleteHeadlineRule(ruleId);
        message.success('已取消推荐');
        await afterWrite();
      } catch {
        /* 已提示 */
      }
    },
  });
}

// ---------------- 弹窗 ----------------
const recommendOpen = ref(false);
const recommendTarget = ref<{ id: number; title: string; uses7d?: number } | null>(null);
function openRecommend(item: HeadlineItem | HeadlineNearMiss | null) {
  recommendTarget.value = item
    ? { id: item.plazaTemplateId, title: item.template.title, uses7d: item.uses7d }
    : null;
  recommendOpen.value = true;
}

const suppressOpen = ref(false);
const suppressTarget = ref<{ id: number; title: string } | null>(null);
function openSuppress(item: HeadlineItem) {
  suppressTarget.value = { id: item.plazaTemplateId, title: item.template.title };
  suppressOpen.value = true;
}

// ---------------- 参数 ----------------
const params = ref<HeadlineParamsView | null>(null);
const paramsDraft = reactive<{
  global: Record<string, unknown>;
  overrides: Record<string, HeadlineOverride>;
}>({
  global: {},
  overrides: {},
});
/** 服务端逐字段校验失败：字段路径（去掉 global. 前缀）→ 原因 */
const paramErrors = ref<Record<string, string>>({});
const overrideLabel: Record<string, string> = {
  'top-n': '榜单条数',
  'min-decayed': '最低衰减复刻数',
  'min-unique-users': '最低去重用户数',
};
const paramFields = computed(() => buildFields(params.value?.meta ?? []));
const paramGroups = computed(() => groupFields(paramFields.value));
const metaOf = (key: string) => params.value?.meta.find((m) => m.key === key);

async function loadParams() {
  try {
    const p = await getHeadlineParams();
    params.value = p;
    paramsDraft.global = clone(p.current.global) as unknown as Record<string, unknown>;
    paramsDraft.overrides = clone(p.current.overrides ?? {});
    paramErrors.value = {};
  } catch {
    /* 已提示 */
  }
}

function setOverride(key: (typeof OVERRIDE_KEYS)[number], v: number | null) {
  const cur: HeadlineOverride = { ...(paramsDraft.overrides[scope.value] ?? {}) };
  if (v === null || v === undefined) delete cur[key];
  else cur[key] = v;
  if (Object.keys(cur).length) paramsDraft.overrides[scope.value] = cur;
  else delete paramsDraft.overrides[scope.value];
}

/** 前端先做范围校验；跨字段（max-visible ≥ top-n 等）与最终校验以服务端 HEADLINE_PARAMS_INVALID 为准 */
function validateParams(): string | null {
  for (const f of paramFields.value) {
    if (f.kind !== 'number') continue;
    const v = getPath(paramsDraft.global, f.key);
    if (typeof v === 'number' && (v < f.min || v > f.max))
      return `${f.label}（${f.key}）需在 ${f.min}~${f.max} 之间`;
  }
  return null;
}

const configBody = () => ({
  global: paramsDraft.global as unknown as HeadlineParamsView['current']['global'],
  overrides: paramsDraft.overrides,
});

const previewing = ref(false);
const diffOpen = ref(false);
const previewResult = ref<HeadlinePreviewResult | null>(null);
async function doPreviewParams() {
  const err = validateParams();
  if (err) return void message.warning(err);
  previewing.value = true;
  try {
    previewResult.value = await previewHeadlines({
      scope: scope.value,
      paramsOverride: configBody(),
    });
    if (!board.value || board.value.scope !== scope.value) await loadBoard();
    diffOpen.value = true;
  } catch {
    /* 已提示 */
  } finally {
    previewing.value = false;
  }
}

const savingParams = ref(false);
async function doSaveParams() {
  const err = validateParams();
  if (err) return void message.warning(err);
  if (!params.value) return;
  savingParams.value = true;
  paramErrors.value = {};
  try {
    const r = await saveHeadlineParams({ config: configBody(), version: params.value.version });
    message.success(`参数已保存，榜单已刷新到 v${r.version}`);
    await Promise.all([loadParams(), afterWrite()]);
  } catch (e) {
    if (e instanceof PlazaError && e.reason === 'HEADLINE_PARAMS_INVALID') {
      for (const f of e.fields ?? [])
        paramErrors.value[f.field.replace(/^global\./, '')] = f.reason;
      message.error(e.message);
    } else if (e instanceof PlazaError && e.reason === 'HEADLINE_PARAMS_CONFLICT') {
      message.error('参数已被他人修改，已刷新为最新值，请确认后再保存');
      await loadParams();
    } else if (e instanceof Error) {
      message.error(e.message);
    }
  } finally {
    savingParams.value = false;
  }
}

// ---------------- 人工规则 ----------------
type RulePhase = HeadlineRule['phase'];
const phaseMeta: Record<RulePhase, { label: string; color: string }> = {
  CURRENT: { label: '生效中', color: 'green' },
  UPCOMING: { label: '未开始', color: 'blue' },
  EXPIRED: { label: '已过期', color: 'default' },
};
const rulePhaseOptions = [
  { label: '生效中', value: 'CURRENT' },
  { label: '未开始', value: 'UPCOMING' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '全部', value: '' },
];
const rulePhase = ref<RulePhase | ''>('CURRENT');
const rules = ref<HeadlineRule[]>([]);
const rulesTotal = ref(0);
const rulePage = ref(1);
const ruleSize = 20;
const rulesLoading = ref(false);

function reloadRules() {
  rulePage.value = 1;
  loadRules();
}
async function loadRules() {
  rulesLoading.value = true;
  try {
    const res = await getHeadlineRules({
      scope: isGlobal.value ? undefined : scope.value,
      phase: rulePhase.value || undefined,
      page: rulePage.value,
      size: ruleSize,
    });
    rules.value = res?.list ?? [];
    rulesTotal.value = res?.total ?? 0;
  } catch {
    /* 已提示 */
  } finally {
    rulesLoading.value = false;
  }
}

function removeRule(r: HeadlineRule, batch: boolean) {
  Modal.confirm({
    title: batch
      ? '同批各范围的推荐一起取消？'
      : `取消「${r.template.title}」在${r.scopeName}的推荐？`,
    content: r.adoptedFromAuto
      ? '这是接管算法项产生的规则，取消 = 取消接管，回到算法排序。'
      : '规则会被删除，模板回到算法评选。',
    okText: '取消推荐',
    onOk: async () => {
      try {
        await deleteHeadlineRule(r.id, batch);
        message.success('已取消推荐');
        await afterWrite();
      } catch {
        /* 已提示 */
      }
    },
  });
}

// ---------------- 抑制名单 ----------------
const suppressions = ref<HeadlineSuppression[]>([]);
const supLoading = ref(false);
const onlyActive = ref(true);
const supColumns = [
  { title: '模板', dataIndex: 'title' },
  { title: '范围', dataIndex: 'scope', width: 120 },
  { title: '类型 / 到期', dataIndex: 'kind', width: 260 },
  { title: '原因', dataIndex: 'reason' },
  { title: '操作人 ID', dataIndex: 'createdBy', width: 100 },
  { title: '操作', key: 'operation', width: 190 },
];

async function loadSuppressions() {
  supLoading.value = true;
  try {
    // active 缺省 = 只看生效中；含过期要显式传 false（API 层已处理）
    suppressions.value =
      (await getHeadlineSuppressions({
        scope: isGlobal.value ? undefined : scope.value,
        active: onlyActive.value,
      })) ?? [];
  } catch {
    /* 已提示 */
  } finally {
    supLoading.value = false;
  }
}

function remaining(until: string | null): string {
  if (!until) return '';
  const ms = dayjs(until).diff(dayjs());
  if (ms <= 0) return '（已过期）';
  const hrs = Math.floor(ms / 3600_000);
  return hrs >= 24
    ? `（剩 ${Math.floor(hrs / 24)} 天 ${hrs % 24} 小时）`
    : `（剩 ${hrs} 小时 ${Math.floor((ms % 3600_000) / 60_000)} 分）`;
}

function removeSuppression(s: HeadlineSuppression, batch: boolean) {
  Modal.confirm({
    title: batch ? '同批一起解除？' : `解除「${s.templateTitle}」在${s.scopeName}的抑制？`,
    content: '解除后该范围重新参与评选，不保证立刻入榜。',
    okText: '解除',
    onOk: async () => {
      try {
        await deleteHeadlineSuppression(s.id, batch);
        message.success('已解除');
        await afterWrite();
      } catch {
        /* 已提示 */
      }
    },
  });
}

watch(onlyActive, loadSuppressions);

onMounted(async () => {
  await loadScopes();
  loadBoard();
  loadSuppressions();
  loadSnapshots();
  loadParams();
});
</script>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tpl-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thumb {
  width: 44px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}
.thumb-empty {
  display: grid;
  place-items: center;
  background: var(--ant-color-fill-quaternary, #f5f5f5);
  color: var(--ant-color-text-quaternary, #bbb);
  font-size: 12px;
}
.title-cell {
  font-weight: 600;
}
.route-code {
  font-size: 12px;
  color: var(--ant-color-text-tertiary, #888);
}
.muted {
  color: var(--ant-color-text-tertiary, #888);
  font-size: 12px;
}
.top {
  color: #722ed1;
}
.trend-up {
  color: #cf1322;
}
.trend-down {
  color: #389e0d;
}
.trend-new {
  color: #fa8c16;
}
.pgroup {
  margin-bottom: 16px;
}
.pgroup-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.pgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px 16px;
}
.plabel {
  font-size: 13px;
  margin-bottom: 4px;
}
.err {
  color: var(--ant-color-error, #ff4d4f);
  font-size: 12px;
}
.history-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
</style>
