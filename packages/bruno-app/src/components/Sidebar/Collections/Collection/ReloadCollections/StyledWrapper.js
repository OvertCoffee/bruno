import styled from 'styled-components';

const StyledWrapper = styled.div`
  .collection-path {
    color: ${(props) => props.theme.colors.text.muted};
    word-break: break-all;
  }
  .warning-icon {
    color: ${(props) => props.theme.status.warning.text};
  }
`;

export default StyledWrapper;
