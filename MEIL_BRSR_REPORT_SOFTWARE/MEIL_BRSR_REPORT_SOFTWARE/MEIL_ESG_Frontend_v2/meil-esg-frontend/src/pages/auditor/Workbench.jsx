import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

import { useApp } from '../../store/AppStore';

import {
  periodLabel,
  principleOf,
  CORE_ATTRS,
} from '../../data/brsr';

import {
  fmt,
} from '../../lib/consolidate';

import {
  ICON_TONE,
  Btn,
  Card,
  CardHeader,
  Modal,
  PageHeader,
  Badge,
  AssuranceBadge,
  Table,
  Tabs,
  EvidenceViewer,
  FileChip,
  inputCls,
  labelCls,
  Empty,
} from '../../components/ui';

import assessmentApi from '../../services/assessmentApi';
import organizationApi from '../../services/organizationApi';
import evidenceApi from '../../services/evidenceApi';


const STATUS_LABEL = {
  NOT_STARTED: 'not_started',
  IN_REVIEW: 'in_review',
  ASSESSED: 'assessed',
  ASSURED: 'assured',
  EXCEPTION: 'exception',
};


const normalizeSubmission = (
  row
) => ({
  id: row.id,
  code: row.code,
  projectId: row.projectId,
  period: row.reportingPeriodId,
  principle: row.principleCode,
  status: row.status,

  assurance:
    STATUS_LABEL[
      row.assessmentStatus
    ] || 'not_started',

  values: Object.fromEntries(
    Object.entries(
      row.values || {}
    ).map(
      ([code, value]) => [
        code,
        {
          id:
            value?.id ?? null,

          v:
            value?.value ??
            '',

          ev:
            Array.isArray(
              value?.evidence
            )
              ? value.evidence[0]
              : '',

          evidence:
            value?.evidence || [],
        },
      ]
    )
  ),

  reviewer: row.reviewComment
    ? {
        comment:
          row.reviewComment,
      }
    : null,

  history:
    row.history || [],
});


export default function Workbench() {
  const {
    user,
    toast,
  } = useApp();

  const [
    submissions,
    setSubmissions,
  ] = useState([]);

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    f,
    setF,
  ] = useState('all');

  const [
    open,
    setOpen,
  ] = useState(null);

  const [
    note,
    setNote,
  ] = useState('');

  const [
    doc,
    setDoc,
  ] = useState(null);


  const load = async () => {
    try {
      setLoading(true);

      const [
        backendRows,
        backendProjects,
      ] = await Promise.all([
        assessmentApi.getWorkbench(),
        organizationApi.getProjects(),
      ]);

      setSubmissions(
        backendRows.map(
          normalizeSubmission
        )
      );

      setProjects(
        backendProjects || []
      );
    } catch (error) {
      toast(
        error.message,
        'error'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, []);


  const projectMap = useMemo(
    () =>
      new Map(
        projects.map(
          (p) => [p.id, p]
        )
      ),
    [projects]
  );


  const approved =
    submissions
      .filter(
        (s) =>
          (
            s.status ===
              'APPROVED' ||
            s.status ===
              'LOCKED'
          )
      )
      .filter((s) =>
        principleOf(
          s.principle
        )
          .indicators
          .some(
            (i) => i.core
          )
      )
      .sort((a, b) =>
        String(b.period)
          .localeCompare(
            String(a.period)
          )
      );


  const rows =
    f === 'all'
      ? approved
      : approved.filter(
          (s) =>
            s.assurance === f
        );


  const count = (
    status
  ) =>
    approved.filter(
      (s) =>
        s.assurance === status
    ).length;


  const sub =
    open
      ? submissions.find(
          (s) =>
            s.id === open
        )
      : null;


  const project =
    sub
      ? projectMap.get(
          sub.projectId
        )
      : null;


  const changeStatus =
    async (status) => {
      if (!sub) return;

      if (
        status ===
          'exception' &&
        !note.trim()
      ) {
        toast(
          'Describe the exception first.',
          'error'
        );
        return;
      }

      try {
        await assessmentApi.setStatus(
          sub.id,
          status,
          note.trim()
        );

        toast(
          `Marked: ${status.replace(
            '_',
            ' '
          )}.`
        );

        setOpen(null);
        setNote('');

        await load();
      } catch (error) {
        toast(
          error.message,
          'error'
        );
      }
    };


  const openEvidence =
    async (
      evidenceId,
      metadata
    ) => {
      if (!evidenceId) {
        return;
      }

      try {
        const blob =
          await evidenceApi.downloadDocument(
            evidenceId
          );

        const url =
          URL.createObjectURL(
            blob
          );

        setDoc({
          ...metadata,
          url,
          documentId:
            evidenceId,
        });
      } catch (error) {
        toast(
          error.message,
          'error'
        );
      }
    };


  return (
    <div className="space-y-6">

      <PageHeader
        badge={
          <>
            <ShieldCheck size={14} />
            Independent assessment / assurance
          </>
        }
        title="Assessment / assurance workbench"
        subtitle="Only BU-approved packets appear here. Review evidence, recompute calculations and record status."
      />


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {[
          [
            'Ready to assure',
            count('not_started'),
            'amber',
            Clock,
          ],
          [
            'In review',
            count('in_review'),
            'blue',
            ShieldCheck,
          ],
          [
            'Assured',
            count('assured'),
            'emerald',
            CheckCircle2,
          ],
          [
            'Exceptions',
            count('exception'),
            'rose',
            AlertTriangle,
          ],
        ].map(
          ([
            label,
            value,
            tone,
            Icon,
          ]) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm"
            >
              <div
                className={`p-3 rounded-lg ${ICON_TONE[tone]}`}
              >
                <Icon size={22} />
              </div>

              <div>
                <p className="text-2xl font-black text-slate-900">
                  {value}
                </p>

                <p className="text-xs font-bold text-slate-500">
                  {label}
                </p>
              </div>
            </div>
          )
        )}

      </div>


      <Tabs
        value={f}
        onChange={setF}
        tabs={[
          {
            id: 'all',
            label: 'All',
          },
          {
            id: 'not_started',
            label: 'Not started',
          },
          {
            id: 'in_review',
            label: 'In review',
          },
          {
            id: 'assured',
            label: 'Assured',
          },
          {
            id: 'exception',
            label: 'Exceptions',
          },
        ]}
      />


      <Card pad={false}>

        {loading ? (
          <p className="p-6 text-sm text-slate-500">
            Loading approved packets…
          </p>
        ) : rows.length === 0 ? (
          <Empty
            title="Nothing in this state"
          />
        ) : (
          <Table
            head={[
              'Packet',
              'Site',
              'Principle',
              'Period',
              'Assurance',
              '',
            ]}
          >
            {rows.map(
              (s) => {
                const project =
                  projectMap.get(
                    s.projectId
                  );

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50"
                  >

                    <td className="px-4 py-3 text-xs font-bold text-blue-600">
                      {s.code || s.id}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {project?.name ||
                        s.projectId}
                    </td>

                    <td className="px-4 py-3">
                      <Badge>
                        {s.principle}
                      </Badge>{' '}
                      {
                        principleOf(
                          s.principle
                        ).label
                      }
                    </td>

                    <td className="px-4 py-3">
                      {periodLabel(
                        s.period
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <AssuranceBadge
                        status={
                          s.assurance
                        }
                      />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Btn
                        tone="dark"
                        className="!py-1.5 !text-xs"
                        onClick={() => {
                          setOpen(
                            s.id
                          );
                          setNote('');
                        }}
                      >
                        Review
                      </Btn>
                    </td>

                  </tr>
                );
              }
            )}
          </Table>
        )}

      </Card>


      {sub && (
        <Modal
          open
          wide
          onClose={() =>
            setOpen(null)
          }
          title={`${sub.code || sub.id} · ${
            project?.name ||
            sub.projectId
          }`}
          subtitle={`${sub.principle} · ${periodLabel(
            sub.period
          )}`}
          footer={
            <>
              <Btn
                tone="danger"
                onClick={() =>
                  changeStatus(
                    'exception'
                  )
                }
              >
                Raise exception
              </Btn>

              <Btn
                tone="ghost"
                onClick={() =>
                  changeStatus(
                    'in_review'
                  )
                }
              >
                Mark in review
              </Btn>

              <Btn
                tone="ok"
                onClick={() =>
                  changeStatus(
                    'assured'
                  )
                }
              >
                <CheckCircle2
                  size={16}
                />
                Mark assured
              </Btn>
            </>
          }
        >

          <div className="border border-slate-200 rounded-xl overflow-x-auto mb-4">

            <Table
              head={[
                'Core attribute',
                'Indicator',
                {
                  label: 'Value',
                  right: true,
                },
                'Evidence',
              ]}
            >

              {principleOf(
                sub.principle
              )
                .indicators
                .filter(
                  (i) => i.core
                )
                .map((i) => {
                  const cell =
                    sub.values[
                      i.id
                    ] || {};

                  const attr =
                    CORE_ATTRS.find(
                      (a) =>
                        a.id ===
                        i.core
                    );

                  const evidenceId =
                    cell.ev ||
                    cell.evidence?.[0];

                  return (
                    <tr
                      key={i.id}
                    >

                      <td className="px-4 py-2 text-xs">
                        {attr?.label ||
                          i.core}
                      </td>

                      <td className="px-4 py-2">
                        {i.label.trim()}
                      </td>

                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {cell.v !==
                          '' &&
                        cell.v != null
                          ? fmt(
                              +cell.v,
                              2
                            )
                          : '–'}

                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                          {i.unit}
                        </span>
                      </td>

                      <td className="px-4 py-2">
                        {evidenceId ? (
                          <FileChip
                            name={`Evidence ${String(
                              evidenceId
                            ).slice(
                              0,
                              8
                            )}`}
                            onClick={() =>
                              openEvidence(
                                evidenceId,
                                {
                                  name:
                                    `Evidence ${String(
                                      evidenceId
                                    ).slice(
                                      0,
                                      8
                                    )}`,
                                  site:
                                    project?.name ||
                                    sub.projectId,
                                  value:
                                    cell.v,
                                  unit:
                                    i.unit,
                                  indicator:
                                    i.label.trim(),
                                  period:
                                    periodLabel(
                                      sub.period
                                    ),
                                }
                              )
                            }
                          />
                        ) : (
                          <span className="text-[11px] text-slate-300">
                            No evidence
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}

            </Table>

          </div>


          <label
            className={labelCls}
          >
            Working notes / exception detail
          </label>

          <textarea
            rows={3}
            className={inputCls}
            value={note}
            onChange={(e) =>
              setNote(
                e.target.value
              )
            }
            placeholder="e.g. Recomputed Scope 2 using DISCOM bill – no difference."
          />

        </Modal>
      )}


      <EvidenceViewer
        doc={doc}
        onClose={() => {
          if (doc?.url) {
            URL.revokeObjectURL(
              doc.url
            );
          }

          setDoc(null);
        }}
      />

    </div>
  );
}