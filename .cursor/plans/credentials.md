/api/v1/wizard/credentials:
    get:
      tags:
      - Wizard
      summary: List credentials
      description: List credentials for wizard selection (summary only, no sensitive data). Similar to known platforms.
      operationId: listWizardCredentials
      security:
      - oauth2:
        - credential:read
      parameters:
      - name: activeOnly
        in: query
        required: false
        schema:
          type: boolean
          description: 'If true, return only active credentials (default: true)'
          default: true
          title: Activeonly
        description: 'If true, return only active credentials (default: true)'
      responses:
        '200':
          description: List of credentials available for selection
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WizardCredentialListResponse'
        '422':
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HTTPValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
  /api/v1/wizard/credentials/{credentialIdOrKey}:
    get:
      tags:
      - Wizard
      summary: Get credential by ID or key
      description: Get a single credential summary by ID or key (no sensitive config).
      operationId: getWizardCredential
      security:
      - oauth2:
        - credential:read
      parameters:
      - name: credentialIdOrKey
        in: path
        required: true
        schema:
          type: string
          description: Credential ID or key
          title: Credentialidorkey
        description: Credential ID or key
      responses:
        '200':
          description: Credential summary
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WizardCredentialInfo'
        '422':
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HTTPValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
        '404':
          $ref: '#/components/responses/NotFound'


/api/v1/credential:
    post:
      tags:
      - Credential
      summary: Create a new credential
      description: Creates a new credential for authenticating with external systems (HubSpot, Salesforce, etc.). Credential values are encrypted at rest.
      operationId: createCredential
      security:
      - oauth2:
        - credential:create
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CredentialCreate'
      responses:
        '201':
          description: The created credential with encrypted configuration
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CredentialResponse'
        '422':
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HTTPValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          $ref: '#/components/responses/Conflict'
    get:
      tags:
      - Credential
      summary: List all credentials
      description: List credentials with pagination, filtering, sorting, and search support.
      operationId: listCredentials
      security:
      - oauth2:
        - credential:read
      parameters:
      - name: search
        in: query
        required: false
        schema:
          anyOf:
          - type: string
          - type: 'null'
          description: Search term to filter credentials by key, displayName, name, or description
          title: Search
        description: Search term to filter credentials by key, displayName, name, or description
      - name: filter
        in: query
        required: false
        schema:
          anyOf:
          - type: string
          - type: 'null'
          description: Filter query (e.g., 'key:eq:hubspot-cred,isActive:eq:true')
          title: Filter
        description: Filter query (e.g., 'key:eq:hubspot-cred,isActive:eq:true')
      - name: sort
        in: query
        required: false
        schema:
          anyOf:
          - type: string
          - type: 'null'
          description: Sort query (e.g., 'key' or '-createdAt')
          title: Sort
        description: Sort query (e.g., 'key' or '-createdAt')
      - name: page
        in: query
        required: false
        schema:
          type: integer
          minimum: 1
          description: Page number
          default: 1
          title: Page
        description: Page number
      - name: pageSize
        in: query
        required: false
        schema:
          type: integer
          maximum: 100
          minimum: 1
          description: Page size
          default: 20
          title: Pagesize
        description: Page size
      responses:
        '200':
          description: Paginated list of credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaginatedListResponse_CredentialResponse_'
        '422':
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HTTPValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
  
  /api/v1/environments/{envKey}/deployments:
    get:
      summary: List deployments for an environment
      description: |
        Get paginated list of deployments for a specific environment.
        Requires deployments:read permission.
      tags:
        - Deployments
      security:
        - oauth2:
            - deployments:read
      parameters:
        - name: envKey
          in: path
          required: true
          schema:
            type: string
          description: Environment key (e.g., 'dev', 'tst', 'pro')
        - $ref: ./schemas/pagination.schema.yaml#/components/parameters/PaginationPage
        - $ref: ./schemas/pagination.schema.yaml#/components/parameters/PaginationPageSize
        - $ref: ./schemas/pagination.schema.yaml#/components/parameters/SortParameter
        - $ref: ./schemas/pagination.schema.yaml#/components/parameters/FilterParameter
        - name: search
          in: query
          schema:
            type: string
          description: Search term to match across deployment fields (case-insensitive partial match)
        - name: status
          in: query
          required: false
          schema:
            type: string
          description: Filter by deployment status (legacy parameter, prefer using filter parameter)
        - name: deploymentType
          in: query
          required: false
          schema:
            type: string
          description: Filter by deployment type (legacy parameter, prefer using filter parameter)
      responses:
        '200':
          description: Paginated list of deployments (SDK format)
          content:
            application/json:
              schema:
                type: object
                required:
                  - meta
                  - data
                  - links
                properties:
                  meta:
                    $ref: ./schemas/pagination.schema.yaml#/components/schemas/Meta
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Deployment'
                  links:
                    $ref: '#/components/schemas/PaginationLinks'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'
      operationId: listEnvironmentsDeployments
  