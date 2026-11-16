// occt-import-js tip tanımı içermez: kullandığımız kadarı
declare module 'occt-import-js' {
  interface OcctModule {
    ReadFile(format: string, data: Uint8Array, params: unknown): {
      success: boolean;
      meshes: {
        name?: string;
        color?: [number, number, number];
        attributes: { position: { array: number[] }; normal?: { array: number[] } };
        index: { array: number[] };
        brep_faces?: { first: number; last: number; color: [number, number, number] | null }[];
      }[];
    };
  }
  export default function occtimportjs(overrides?: { locateFile?: (path: string) => string }): Promise<OcctModule>;
}
