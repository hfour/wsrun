export enum ResultSpecialValues {
    Pending = 'PENDING',
    Excluded = 'EXCLUDED',
    MissingScript = 'MISSING_SCRIPT',
    NotStarted = 'NOT_STARTED',
    Cancelled = 'CANCELLED'
}

export type Result = number | ResultSpecialValues

export enum ProcResolution {
    Normal = 'Normal',
    Missing = 'Missing',
    Excluded = 'Excluded'
}
